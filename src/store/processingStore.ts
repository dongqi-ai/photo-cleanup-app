/**
 * Processing Store
 *
 * Tracks pipeline execution state and stores the ProcessingResult.
 */

import { create } from 'zustand';
import type { PipelineProgress, PipelineStage, ProcessingResult } from '../types';

interface ProcessingState {
  stage: PipelineStage;
  progress: number;
  message: string;
  error: string | undefined;
  result: ProcessingResult | null;

  // ── Actions ──────────────────────────────────────────────────────────
  setProgress: (p: PipelineProgress) => void;
  setResult: (result: ProcessingResult) => void;
  setError: (error: string) => void;
  reset: () => void;
}

const INITIAL: Pick<ProcessingState, 'stage' | 'progress' | 'message' | 'error' | 'result'> = {
  stage: 'idle',
  progress: 0,
  message: '',
  error: undefined,
  result: null,
};

export const useProcessingStore = create<ProcessingState>((set) => ({
  ...INITIAL,

  setProgress: (p) =>
    set({
      stage: p.stage,
      progress: p.progress,
      message: p.message,
      error: p.error,
    }),

  setResult: (result) =>
    set({ result, stage: 'complete', progress: 1.0, message: 'Analysis complete' }),

  setError: (error) =>
    set({ error, stage: 'error', message: error }),

  reset: () => set(INITIAL),
}));
