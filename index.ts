// Public API exports for @sledge/anvil
export type { PatchMetadata } from './src/types/patch/Patch.js';
export type { Point, RGBA, Size, TileBounds, TileIndex, TileInfo } from './src/types/types.js';

// Core classes
export { Anvil } from './src/Anvil.js';
export { PixelBuffer } from './src/buffer/PixelBuffer.js';
export type { TransferOptions } from './src/buffer/PixelBuffer.js';

// For advanced usage - direct access to components
export { LayerDiffsController } from './src/buffer/LayerDiffsController.js';
export { LayerTilesController } from './src/buffer/LayerTilesController.js';

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
