/**
 * Whole Buffer Diff
 * unpacked: size + raw RGBA buffer
 * packed: size + webp buffer
 */

export interface WholePatchData {
  width: number;
  height: number;
  swapBuffer: Uint8ClampedArray;
}

export interface PackedWholePatchData {
  width: number;
  height: number;
  swapBufferWebp: Uint8Array;
}
