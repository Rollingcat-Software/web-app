/**
 * Client-side ML module — Phase 4.2 of FIVUCSAS client-side inference migration.
 *
 * @see CLIENT_SIDE_ML_PLAN.md
 */

export { BlazeFaceDetector } from './BlazeFaceDetector';
export type {
  BlazeFaceDetection,
  BlazeFaceResult,
  NormalizedBoundingBox,
} from './BlazeFaceDetector';

export { useBlazeFace } from './useBlazeFace';
export type { UseBlazeFaceReturn } from './useBlazeFace';
