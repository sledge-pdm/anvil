import { RGBA, TileIndex } from '../types';

/**
 * Tile Fill Diff
 * unpacked: index + before/after RGBA
 * packed: index + before/after packed RGBA32
 */

export interface TileFillPatchData {
  tileIndex: TileIndex;
  before?: RGBA;
  after: RGBA;
}

export interface PackedTileFillPatchData {
  tileIndex: TileIndex;
  before?: number; // packed RGBA32, undefined = was non-uniform
  after: number; // packed RGBA32
}
