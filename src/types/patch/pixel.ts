import { RGBA } from '../types';

/**
 * Pixel Diff
 * unpacked: position + before/after RGBA
 * packed: position + before/after packed RGBA32
 */

export interface PixelPatchData {
  x: number;
  y: number;
  before: RGBA;
  after: RGBA;
}

export interface PackedPixelPatchData {
  x: number;
  y: number;
  before: number; // packed RGBA32
  after: number; // packed RGBA32
}
