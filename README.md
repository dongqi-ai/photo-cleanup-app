# Photo Cleanup

An offline-first React Native app that helps you find duplicate and burst-like photos, recommends which ones to keep, and guides you through safe deletion with explicit review.

## What It Does

1. **Select Photos** — Choose 20-50 photos from your library
2. **Analyze** — The app groups likely duplicates and burst shots using on-device heuristics
3. **Review** — See recommendations with confidence scores and explanations
4. **Confirm & Delete** — Review each group, override keep selections if needed, then confirm deletions

## Architecture

### Tech Stack

- **React Native** with TypeScript
- **Expo** (prebuild / dev client workflow)
- **Expo Router** for file-based navigation
- **Zustand** for lightweight state management
- **Plain React Native styling** (no external UI library dependency)

### Key Dependencies

- `expo-media-library` — Photo library access and deletion
- `expo-file-system` — Available for future thumbnail caching

## Project Structure

```
src/
  app/              — Expo Router screens (home, picker, processing, review, settings)
  components/       — Reusable UI components (picker, processing, review, shared)
  domain/
    photo/          — PhotoAssetService, ThumbnailService
    similarity/     — SimilarityEngine, ClusteringEngine
    quality/        — QualityEngine
    recommendation/ — RecommendationService, ExplanationService
    cleanup/        — Pipeline, DeletionPlanner, DeleteService
  hooks/            — usePhotoPicker, useProcessing
  store/            — Zustand stores (selection, processing, review, settings)
  lib/              — Utils and cache helpers
  constants/        — App constants and weight configs
  types/            — TypeScript interfaces and types
__tests__/          — Unit tests for pure domain logic
```

## Domain Pipeline

The cleanup pipeline runs entirely on-device:

1. **Normalize/filter assets** — Validate selected photos
2. **Build analysis inputs** — Extract metadata (dimensions, timestamps, HDR, Live Photo flags)
3. **Generate candidate pairs** — Time-aware windowing + metadata heuristics
4. **Cluster** — Union-Find transitive closure groups related photos
5. **Rank quality** — Interpretable signals: resolution, file size, recency, HDR, Live Photo
6. **Build recommendations** — Conservative: only recommend when confidence margin is clear
7. **Build deletion plan** — Structured plan for user review, never auto-delete

## MVP Implementation Choices

### What Is Real

- **Photo access** via `expo-media-library` (real permissions, real asset loading)
- **Metadata analysis** using actual photo dimensions, timestamps, and mediaSubtypes
- **Deterministic heuristic similarity** using time proximity, dimensions, aspect ratio, filename patterns, file size, and orientation
- **Transitive clustering** via Union-Find for grouping burst sequences
- **Quality ranking** with weighted, interpretable signals
- **Conservative recommendation** requiring 15% confidence margin
- **Deletion planning** with explicit per-cluster confirmation
- **Full review UI** with override capability

### What Is Mocked / Simplified

- **No native ML embeddings** — The `EmbeddingSimilarityEngine` and `EmbeddingModel` interface exist but are not wired into the default pipeline. The `HeuristicSimilarityEngine` is the active adapter.
- **No native thumbnail generation** — `MetadataThumbnailService` extracts metadata without generating actual resized thumbnails. `NativeThumbnailService` is a placeholder for future `expo-image-manipulator` integration.
- **Delete execution is UI-simulated** — The review screen shows an alert confirming the deletion plan but does not actually call `deleteAssetsAsync` in this MVP. The `ExpoDeleteService` adapter is fully implemented and ready to wire in.
- **Settings are in-memory only** — No persistent storage for user preferences yet.

### Why These Choices

The app prioritizes **correctness, testability, and trust** over sophistication. A deterministic heuristic pipeline that runs reliably today is more valuable than a blocked ML integration. The architecture uses replaceable interfaces (`SimilarityEngine`, `ClusteringEngine`, `QualityEngine`, etc.) so native ML can be swapped in later without changing the app screens or stores.

## Running the App

### Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator or Android Emulator (or physical device with Expo Go)

### Setup

```bash
git clone https://github.com/kunikhanna/photo-cleanup-app.git
cd photo-cleanup-app
npm install
```

### Development

```bash
# Start the dev server
npx expo start

# iOS
npx expo run:ios

# Android
npx expo run:android
```

### Testing

```bash
# Run unit tests for domain logic
npm test

# Type check
npm run typecheck

# Lint
npm run lint
```

## Testing

Unit tests cover the pure domain logic:

- `similarityEngine.test.ts` — Candidate generation, signal computation, filename burst detection
- `clusteringEngine.test.ts` — Union-Find transitive closure, cluster status assignment
- `qualityEngine.test.ts` — Quality ranking, signal normalization, confidence margin
- `recommendationService.test.ts` — Conservative recommendation, low-confidence rejection
- `deletionPlanner.test.ts` — Plan building, confirmation flow, user override application

## Next Steps for Native ML

1. **Integrate `expo-image-manipulator`** for actual thumbnail generation
2. **Add TensorFlow Lite** or **ONNX Runtime** for on-device visual embeddings
3. **Implement `EmbeddingSimilarityEngine`** as the active adapter, blending embedding similarity with time proximity
4. **Add persistent settings storage** via `expo-secure-store` or `AsyncStorage`
5. **Wire `ExpoDeleteService.executePlan`** into the review screen with proper error handling and recovery UX
6. **Add batch/cluster-level undo** within the review flow

## Privacy

- All processing happens on your device
- No backend, no accounts, no cloud sync
- No ads, no subscriptions
- Photos are never uploaded

## License

MIT
