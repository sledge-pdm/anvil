// Core types for Anvil
export type RGBA = [r: number, g: number, b: number, a: number];

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface TileIndex {
  row: number;
  col: number;
}

export interface TileBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TileInfo {
  index: TileIndex;
  bounds: TileBounds;
  isDirty: boolean;
  isUniform: boolean;
  uniformColor?: RGBA;
}

// Utility functions for color conversion
export function rgbaToPackedU32(rgba: RGBA): number {
  return (rgba[3] << 24) | (rgba[0] << 16) | (rgba[1] << 8) | rgba[2];
}

export function packedU32ToRgba(packed: number): RGBA {
  return [(packed >> 16) & 0xff, (packed >> 8) & 0xff, packed & 0xff, (packed >>> 24) & 0xff];
}

export function tileIndexToLinear(index: TileIndex, cols: number): number {
  return index.row * cols + index.col;
}

export function linearToTileIndex(linear: number, cols: number): TileIndex {
  return {
    row: Math.floor(linear / cols),
    col: linear % cols,
  };
}
