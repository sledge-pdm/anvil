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