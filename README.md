# Photo Cleanup

A React Native (Expo) mobile app MVP for offline photo duplicate detection and safe deletion.  
**No backend. No accounts. No cloud. No ads. No subscriptions.**

---

## What it does

Select 2–50 photos from your device library. The app groups likely duplicate and burst-like shots using timing and metadata heuristics, recommends one photo per group to keep, and lets you review every decision before anything is deleted.

---

## Project structure

```
src/
├── app/                        # Expo Router screens
│   ├── _layout.tsx             # Root stack layout
│   ├── index.tsx               # Home screen
│   ├── picker.tsx              # Photo selection grid
│   ├── processing.tsx          # Pipeline progress
│   ├── review.tsx              # Group review + deletion
│   └── settings.tsx            # Settings modal
│
├── components/
│   ├── picker/                 # Picker-specific components
│   ├── processing/             # Processing UI
│   ├── review/                 # Review cards
│   └── shared/                 # Reusable UI primitives
│
├── domain/
│   ├── photo/
│   │   ├── PhotoAssetService.ts    # expo-media-library wrapper
│   │   └── Pipeline.ts            # Orchestrator (all 6 stages)
│   ├── similarity/
│   │   ├── CandidateSelectorService.ts   # Time-windowed pair scoring
│   │   └── ClusteringEngine.ts           # Union-Find clustering
│   ├── quality/
│   │   └── QualityEngine.ts       # Per-photo quality signal computation
│   ├── recommendation/
│   │   ├── RecommendationService.ts     # Keep/delete recommendations
│   │   └── ExplanationService.ts        # Human-readable reasons
│   └── cleanup/
│       └── DeletionPlanner.ts     # Plan building + executor
│
├── hooks/
│   ├── usePhotoLibrary.ts     # Permission + asset loading
│   ├── usePipeline.ts         # Pipeline runner
│   └── useDeletion.ts         # Deletion plan management
│
├── store/
│   ├── selectionStore.ts      # Zustand: photo selection
│   ├── processingStore.ts     # Zustand: pipeline progress + result
│   ├── reviewStore.ts         # Zustand: group decisions + deletion plan
│   └── settingsStore.ts       # Zustand: user settings
│
├── lib/
│   ├── utils/
│   │   ├── generateId.ts      # Session-scoped ID generator
│   │   └── formatters.ts      # UI display helpers
│   └── cache/
│       └── ThumbnailCache.ts  # In-memory thumbnail URI cache
│
├── constants/
│   └── index.ts               # Colors, spacing, thresholds, weights
│
└── types/
    └── index.ts               # All shared types + interfaces
```

---

## How to run

### Prerequisites

- Node.js 18+
- Expo CLI: `npm install -g @expo/cli`
- For iOS: Xcode + iOS Simulator or physical device
- For Android: Android Studio + emulator or physical device

### Install

```bash
npm install
```

### Run in Expo Go (development)

```bash
npx expo start
```

Scan the QR code with Expo Go (iOS/Android).

> **Note:** `expo-media-library` delete functionality requires a development build — Expo Go restricts media deletion. For full functionality including deletion, use a dev build:

### Build a dev client (for deletion support)

```bash
# iOS
npx expo run:ios

# Android
npx expo run:android
```

Or use EAS Build:

```bash
npx eas build --profile development --platform ios
```

### Run tests

```bash
npm test
```

### Run tests with coverage

```bash
npm test -- --coverage
```

### Typecheck

```bash
npm run typecheck
```

---

## MVP implementation choices

### What is real (deterministic, working)

| Component | Status | Notes |
|---|---|---|
| Time-aware candidate pairing | ✅ Real | Burst window (8s) + near-duplicate window (30s) |
| Filename pattern detection | ✅ Real | Sequential numeric suffix (IMG_001, IMG_002) |
| Resolution similarity scoring | ✅ Real | Normalised pixel count comparison |
| File size similarity scoring | ✅ Real | Byte ratio heuristic |
| Union-Find clustering | ✅ Real | O(n·α) — fully deterministic |
| Quality signal computation | ✅ Real | Resolution, sharpness proxy, brightness proxy, file size |
| Recommendation service | ✅ Real | Confidence + margin threshold gating |
| Manual-review state | ✅ Real | Triggered when margin < 0.08 or confidence < 0.70 |
| Deletion planner | ✅ Real | Pure plan model, execution separate from planning |
| Zustand state management | ✅ Real | Three independent stores |
| Expo Router navigation | ✅ Real | Home → Picker → Processing → Review → Settings |
| expo-media-library integration | ✅ Real | Permission, asset loading, deletion |
| Settings (tunable thresholds) | ✅ Real | Persisted in store; future: AsyncStorage |

### What is mocked / simplified in this MVP

| Component | MVP Approach | Future Plan |
|---|---|---|
| **Sharpness detection** | Bytes-per-pixel ratio (metadata proxy) | Native image decoding or TFLite/CoreML blur model |
| **Brightness / exposure** | Filename keyword heuristic | On-device histogram analysis or ML exposure model |
| **Visual similarity** | Not computed — metadata only | TFLite MobileNet embedding → cosine similarity |
| **Thumbnail cache** | In-memory `Map<id, uri>` | Persisted to `expo-file-system` cache directory |
| **Settings persistence** | In-memory Zustand store | `AsyncStorage` |
| **Review UI thumbnails** | Placeholder rank/score display | `expo-image` thumbnails from `asset.uri` |

### Why metadata-only for MVP

Computing visual embeddings requires either:
1. A bundled TFLite model (~5 MB) + native bridge (TensorFlow Lite React Native or tfjs-react-native), or
2. On-device CoreML (iOS) / NNAPI (Android) integration via a custom native module

Both are achievable but would block a working first pass. The metadata heuristics are:
- Fully deterministic and testable without device hardware
- Sufficient to catch the vast majority of burst sequences (same timing + sequential filenames = high confidence)
- Easy to replace: the `SimilarityEngineAdapter` interface allows dropping in a TFLite adapter without changing the clustering or recommendation stages

---

## Algorithm walkthrough

```
Selected photos
       │
       ▼
1. normalizeAssets()
   Filter: remove videos, zero-dimension, duplicates
       │
       ▼
2. CandidateSelectorService.generateCandidatePairs()
   Sort by creationTime → slide time window
   Score each pair: temporal(45%) + resolution(20%) + filename(20%) + fileSize(15%)
   Accept pairs with score ≥ similarityThreshold (default 0.65)
       │
       ▼
3. ClusteringEngine.cluster()
   Union-Find: union all accepted pairs
   Each connected component = candidate group
   Groups with < 2 photos → ungrouped (skipped)
       │
       ▼
4. QualityEngine.computeGroupQuality()
   Per-photo: resolutionScore, sharpnessProxy, brightnessProxy, fileSizeScore
   Normalize all signals within the group (group max = 1.0)
   Compute compositeScore = weighted sum
       │
       ▼
5. QualityEngine.rankByQuality()
   Sort assetIds in each group by compositeScore descending
       │
       ▼
6. RecommendationService.applyRecommendations()
   margin = topScore - secondScore
   confidence = f(margin) ∈ [0,1]
   if confidence ≥ 0.70 AND margin ≥ 0.08:
     status = 'actionable', recommendedKeepId = rank-0 asset
     plannedDeletionIds = all other assets
   else:
     status = 'manual-review', no auto-recommendation
       │
       ▼
7. User reviews each group in ReviewScreen
   Accept / override / skip per group
       │
       ▼
8. DeletionPlanner.buildDeletionPlan()
   Only reviewed groups contribute items
   userDeletionIds > plannedDeletionIds
   Items start as confirmed=false
       │
       ▼
9. User confirms + executes DeletionExecutor.execute()
   Only confirmed items are deleted
   Results recorded per-item (success/failure)
```

---

## Conservative design decisions

- **Precision over recall**: a photo pair must score ≥ 0.65 similarity to be grouped. We miss some duplicates rather than group unrelated photos.
- **No auto-delete**: the deletion plan is built, reviewed, confirmed, then executed — four explicit steps.
- **Margin gating**: even if two photos are in the same group, the recommendation is suppressed if the quality difference is too small (margin < 0.08) — the group goes to manual review instead.
- **Language**: "recommended keep" not "best shot"; "likely duplicate" not "identical"; "may be deleted" not "will be deleted".
- **Platform note**: iOS presents a system confirmation dialog before deletion; Android deletion is permanent. The app surfaces this distinction in the home screen and deletion confirmation.

---

## Running tests

All unit tests are in `src/domain/**/__tests__/`. They cover:

| Test file | What it tests |
|---|---|
| `CandidateSelectorService.test.ts` | All 4 signal scorers + pair generation + windowing |
| `ClusteringEngine.test.ts` | Union-Find components, group formation, deduplication |
| `QualityEngine.test.ts` | All signal scorers, composite computation, ranking |
| `RecommendationService.test.ts` | Confidence function, status gating, recommendation logic |
| `DeletionPlanner.test.ts` | Plan building, dedup, confirmation, plan utilities |
| `Pipeline.test.ts` | End-to-end integration: grouping, accounting, progress |

```bash
npm test
```

---

## Next steps for native ML integration

1. **Add TFLite adapter** (`src/domain/similarity/TFLiteEmbeddingAdapter.ts`)  
   Implement `SimilarityEngineAdapter` using `tfjs-react-native` + a MobileNetV3 or EfficientNet-Lite model.  
   Drop it in as a replacement for the metadata heuristic adapter in `Pipeline.ts`.

2. **Thumbnail generation** (`src/lib/cache/ThumbnailCache.ts`)  
   Use `expo-image-manipulator` to resize photos to 224×224 before embedding.  
   Persist thumbnails to `expo-file-system` cache to avoid re-computation.

3. **Cosine similarity** instead of metadata score for visual pairs.  
   Keep metadata signals as a pre-filter to avoid comparing all-pairs (O(n²)).

4. **AsyncStorage persistence** for settings and last session state.

5. **Photo thumbnails in review UI** — wire `expo-image` to `asset.uri` in `PhotoTile` component.

6. **Swipe-to-review** UX for faster group navigation on mobile.

7. **Session history** — record what was deleted and when.
