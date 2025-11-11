import { RGBA } from '../types';

/**
 * Pixel Diff
 * unpacked: position + previous RGBA (pre-change value)
 * packed: position + previous color stored as packed RGBA32
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
