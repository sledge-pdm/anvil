// Public API exports for @sledge/anvil
export type { PatchMetadata } from './src/types/patch/Patch.js';
export type { Point, RGBA, Size, TileBounds, TileIndex, TileInfo } from './src/types/types.js';

// Core classes
export { Anvil } from './src/Anvil.js';
export { PixelBuffer } from './src/buffer/PixelBuffer.js';

// For advanced usage - direct access to components
export { LayerDiffsController } from './src/buffer/LayerDiffsController.js';
export { LayerTilesController } from './src/buffer/LayerTilesController.js';
export {
  linearToTileIndex,
  packPending,
  packedU32ToRgba,
  pngToRaw,
  rawToPng,
  rawToWebp,
  rgbaToPackedU32,
  tileIndexToLinear,
  tileKey,
  webpToRaw,
} from './src/ops/packing/Packing.js';

// Ops
export { floodFill } from './src/ops/fill/FloodFill.js';
export { putShape, putShapeLine, type ShapeMask } from './src/ops/pattern/Pattern.js';
export { transferBuffer } from './src/ops/transfer/Transfer.js';
