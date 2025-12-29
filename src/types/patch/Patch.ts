import type { PackedPartialPatchData } from './partial.js';
import type { PackedPixelPatchData, PixelPatchData } from './pixel.js';
import type { PackedWholePatchData } from './whole.js';

export type PatchType = 'pixel' | 'partial' | 'whole';

export interface PendingDiffs {
  pixels: PixelPatchData[];
  partial?: PackedPartialPatchData;
  whole?: PackedWholePatchData;
}

export interface PackedDiffs {
  pixels?: PackedPixelPatchData[];
  partial?: PackedPartialPatchData;
  whole?: PackedWholePatchData;
}

// Metadata for patch application
export interface PatchMetadata {
  layerId?: string;
  tool?: string;
  timestamp?: number;
  pixelCount?: number;
}
