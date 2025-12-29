// Public API exports for @sledge/anvil
export type { PackedPartialPatchData, PartialPatchData } from './src/types/patch/partial.js';
export type { PackedDiffs, PatchMetadata } from './src/types/patch/Patch.js';
export type { PackedPixelPatchData, PixelPatchData } from './src/types/patch/pixel.js';
export type { PackedWholePatchData, WholePatchData } from './src/types/patch/whole.js';
export { toUint8Array, toUint8ClampedArray } from './src/types/rawBuffer.js';
export type { RawPixelData } from './src/types/rawBuffer.js';
export type { Point, Size, TileBounds, TileIndex, TileInfo } from './src/types/types.js';

// Core classes
export { Anvil, type TransferOptions } from './src/Anvil_Old.js';

// For advanced usage - direct access to components
export { DiffsController } from './src/buffer/DiffsController.js';
export { TilesController } from './src/buffer/TilesController.js';

// Ops
export {
  linearToTileIndex,
  packPending,
  packedU32ToRgba,
  pngToRaw,
  rawToPng,
  rawToWebp,
  rgbaToPackedU32,
  tileIndexToLinear,
  webpToRaw,
} from './src/ops/Packing.js';
export { putShape, putShapeLine, type ShapeMask } from './src/ops/Shape.js';

// WASM enums
export { AlphaBlurMode, AntialiasMode, DitheringMode, RgbaBuffer } from './src/wasm/pkg/anvil_wasm.js';
