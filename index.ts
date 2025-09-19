// Public API exports for @sledge/anvil
export type { Patch, PatchMetadata } from './src/patch.js';
export type { LayerPatch, Point, RGBA, Size, TileBounds, TileIndex, TileInfo } from './src/types.js';

// Core classes
export { Anvil } from './src/Anvil.js';
export { PixelBuffer } from './src/buffer/PixelBuffer.js';

// Utility functions
export { linearToTileIndex, packedU32ToRgba, rgbaToPackedU32, tileIndexToLinear } from './src/types.js';

// For advanced usage - direct access to components
export { LayerDiffs } from './src/diff/LayerDiffs.js';
export { LayerDiffsController } from './src/diff/LayerDiffsController.js';
export { LayerTiles } from './src/tile/LayerTiles.js';
export { LayerTilesController } from './src/tile/LayerTilesController.js';
