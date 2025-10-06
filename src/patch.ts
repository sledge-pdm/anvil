import type { TileIndex } from './types.js';

// Patch types for change tracking
export interface LayerPatch {
  // Tile-level uniform fills
  tiles?: Array<{
    tile: TileIndex;
    before?: number; // packed RGBA32, undefined = was non-uniform
    after: number; // packed RGBA32
  }>;

  // Pixel-level changes within tiles
  pixels?: Array<{
    tile: TileIndex;
    idx: Uint16Array; // tile-local indices (0..tileSize²-1)
    before: Uint32Array; // packed RGBA32
    after: Uint32Array; // packed RGBA32
  }>;

  // Partial rectangular buffer replacement (sub-rectangle of layer)
  partial?: {
    boundBox: { x: number; y: number; width: number; height: number };
    before: Uint8ClampedArray; // length = w*h*4
    after: Uint8ClampedArray; // length = w*h*4
  };

  // Whole buffer replacement (for large changes like canvas resize)
  whole?: {
    before: Uint8ClampedArray;
    after: Uint8ClampedArray;
  };
}

// Metadata for patch application
export interface PatchMetadata {
  layerId?: string;
  tool?: string;
  timestamp?: number;
  pixelCount?: number;
}
