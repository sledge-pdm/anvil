// Public API exports for @sledge/anvil
export type { PackedPartialPatchData, PartialPatchData } from './src/types/patch/partial.js';
export type { PackedDiffs, PatchMetadata } from './src/types/patch/Patch.js';
export type { PackedPixelPatchData, PixelPatchData } from './src/types/patch/pixel.js';
export type { PackedWholePatchData, WholePatchData } from './src/types/patch/whole.js';
export { toUint8Array, toUint8ClampedArray } from './src/types/rawBuffer.js';
export type { RawPixelData } from './src/types/rawBuffer.js';
export type { Point, RGBA, Size, TileBounds, TileIndex, TileInfo } from './src/types/types.js';

// Core classes
export { Anvil } from './src/Anvil.js';
export { RgbaBuffer } from './src/buffer/RgbaBuffer.js';
export type { TransferOptions } from './src/buffer/RgbaBuffer.js';

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

// WASM enum
export { AntialiasMode } from './src/ops_wasm/pkg/anvil_ops_wasm.js';
