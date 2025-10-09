import { RGBA } from '../types';

/**
 * Pixel Diff
 * unpacked: position + before/after RGBA
 * packed: position + before/after packed RGBA32
 */

export interface PixelPatchData {
  x: number;
  y: number;
  color: RGBA;
}

export interface PackedPixelPatchData {
  x: number;
  y: number;
  color: number; // packed RGBA32
}
