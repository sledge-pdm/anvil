import { PackedPartialPatchData } from './partial.js';
import { PackedPixelPatchData, PixelPatchData } from './pixel.js';
import { PackedTileFillPatchData, TileFillPatchData } from './tileFill.js';
import { PackedWholePatchData } from './whole.js';

export type PatchType = 'pixel' | 'tile' | 'partial' | 'whole';

export interface PendingDiffs {
  pixels: PixelPatchData[];
  tileFills: Map<string, TileFillPatchData>;
  partial?: PackedPartialPatchData;
  whole?: PackedWholePatchData;
}

export interface PackedDiffs {
  pixels?: PackedPixelPatchData[];
  tiles?: PackedTileFillPatchData[];
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
