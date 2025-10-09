/**
 * Partial Buffer Diff
 * unpacked: boundBox + raw RGBA buffer
 * packed: boundBox + webp buffer
 */

export interface PartialPatchData {
  boundBox: { x: number; y: number; width: number; height: number };
  swapBuffer: Uint8ClampedArray;
}

export interface PackedPartialPatchData {
  boundBox: { x: number; y: number; width: number; height: number };
  swapBufferWebp: Uint8Array;
}
