import type { RGBA, TileBounds, TileIndex, TileInfo } from '../../types.js';
import { packedU32ToRgba, rgbaToPackedU32, tileIndexToLinear } from '../../types.js';

/**
 * Model: Manages tile grid state - dirty flags and uniform colors
 * Responsible for: bitset storage, uniform color tracking, bounds calculation
 */
export class LayerTiles {
  public readonly tileSize: number;
  public readonly rows: number;
  public readonly cols: number;
  public readonly totalTiles: number;

  // Bitset storage for flags (more memory efficient than boolean arrays)
  private dirtyFlags: Uint32Array;
  private uniformFlags: Uint32Array;

  // Sparse storage for uniform colors (only store when tile is uniform)
  private uniformColors: Map<number, number> = new Map(); // tileIndex -> packed RGBA32

  constructor(width: number, height: number, tileSize = 32) {
    this.tileSize = tileSize;
    this.cols = Math.ceil(width / tileSize);
    this.rows = Math.ceil(height / tileSize);
    this.totalTiles = this.rows * this.cols;

    // Allocate bitsets (32 tiles per uint32)
    const flagArraySize = Math.ceil(this.totalTiles / 32);
    this.dirtyFlags = new Uint32Array(flagArraySize);
    this.uniformFlags = new Uint32Array(flagArraySize);
  }

  /**
   * Convert pixel coordinates to tile index
   */
  pixelToTileIndex(x: number, y: number): TileIndex {
    return {
      row: Math.floor(y / this.tileSize),
      col: Math.floor(x / this.tileSize),
    };
  }

  /**
   * Get tile bounds in pixel coordinates
   */
  getTileBounds(index: TileIndex): TileBounds {
    return {
      x: index.col * this.tileSize,
      y: index.row * this.tileSize,
      width: this.tileSize,
      height: this.tileSize,
    };
  }

  /**
   * Check if tile index is valid
   */
  isValidTileIndex(index: TileIndex): boolean {
    return index.row >= 0 && index.row < this.rows && index.col >= 0 && index.col < this.cols;
  }

  /**
   * Get tile dirty flag
   */
  isDirty(index: TileIndex): boolean {
    if (!this.isValidTileIndex(index)) return false;

    const linear = tileIndexToLinear(index, this.cols);
    const wordIndex = Math.floor(linear / 32);
    const bitIndex = linear % 32;

    return (this.dirtyFlags[wordIndex] & (1 << bitIndex)) !== 0;
  }

  /**
   * Set tile dirty flag
   */
  setDirty(index: TileIndex, dirty: boolean): void {
    if (!this.isValidTileIndex(index)) return;

    const linear = tileIndexToLinear(index, this.cols);
    const wordIndex = Math.floor(linear / 32);
    const bitIndex = linear % 32;

    if (dirty) {
      this.dirtyFlags[wordIndex] |= 1 << bitIndex;
    } else {
      this.dirtyFlags[wordIndex] &= ~(1 << bitIndex);
    }
  }

  /**
   * Get tile uniform flag
   */
  isUniform(index: TileIndex): boolean {
    if (!this.isValidTileIndex(index)) return false;

    const linear = tileIndexToLinear(index, this.cols);
    const wordIndex = Math.floor(linear / 32);
    const bitIndex = linear % 32;

    return (this.uniformFlags[wordIndex] & (1 << bitIndex)) !== 0;
  }

  /**
   * Set tile uniform flag and color
   */
  setUniform(index: TileIndex, uniform: boolean, color?: RGBA): void {
    if (!this.isValidTileIndex(index)) return;

    const linear = tileIndexToLinear(index, this.cols);
    const wordIndex = Math.floor(linear / 32);
    const bitIndex = linear % 32;

    if (uniform && color) {
      this.uniformFlags[wordIndex] |= 1 << bitIndex;
      this.uniformColors.set(linear, rgbaToPackedU32(color));
    } else {
      this.uniformFlags[wordIndex] &= ~(1 << bitIndex);
      this.uniformColors.delete(linear);
    }
  }

  /**
   * Get tile uniform color (returns undefined if not uniform)
   */
  getUniformColor(index: TileIndex): RGBA | undefined {
    if (!this.isUniform(index)) return undefined;

    const linear = tileIndexToLinear(index, this.cols);
    const packed = this.uniformColors.get(linear);

    return packed !== undefined ? packedU32ToRgba(packed) : undefined;
  }

  /**
   * Get complete tile information
   */
  getTileInfo(index: TileIndex): TileInfo {
    return {
      index,
      bounds: this.getTileBounds(index),
      isDirty: this.isDirty(index),
      isUniform: this.isUniform(index),
      uniformColor: this.getUniformColor(index),
    };
  }

  /**
   * Iterate all dirty tiles
   */
  forEachDirty(callback: (info: TileInfo) => void): void {
    for (let linear = 0; linear < this.totalTiles; linear++) {
      const wordIndex = Math.floor(linear / 32);
      const bitIndex = linear % 32;

      if ((this.dirtyFlags[wordIndex] & (1 << bitIndex)) !== 0) {
        const index = {
          row: Math.floor(linear / this.cols),
          col: linear % this.cols,
        };
        callback(this.getTileInfo(index));
      }
    }
  }

  /**
   * Get array of all dirty tile indices (for renderer convenience)
   */
  getDirtyTileIndices(): TileIndex[] {
    const result: TileIndex[] = [];
    this.forEachDirty((info) => result.push(info.index));
    return result;
  }

  /**
   * Clear all dirty flags
   */
  clearAllDirty(): void {
    this.dirtyFlags.fill(0);
  }

  /**
   * Set all tiles as dirty (useful for full refresh)
   */
  setAllDirty(): void {
    this.dirtyFlags.fill(0xffffffff);

    // Clear excess bits in the last word
    const excessBits = this.totalTiles % 32;
    if (excessBits > 0) {
      const lastWordIndex = this.dirtyFlags.length - 1;
      const mask = (1 << excessBits) - 1;
      this.dirtyFlags[lastWordIndex] &= mask;
    }
  }

  /**
   * Get statistics for debugging
   */
  getStats(): {
    totalTiles: number;
    dirtyTiles: number;
    uniformTiles: number;
    memoryUsage: number; // bytes
  } {
    let dirtyCount = 0;
    let uniformCount = 0;

    for (let linear = 0; linear < this.totalTiles; linear++) {
      const wordIndex = Math.floor(linear / 32);
      const bitIndex = linear % 32;

      if ((this.dirtyFlags[wordIndex] & (1 << bitIndex)) !== 0) {
        dirtyCount++;
      }
      if ((this.uniformFlags[wordIndex] & (1 << bitIndex)) !== 0) {
        uniformCount++;
      }
    }

    const memoryUsage = this.dirtyFlags.byteLength + this.uniformFlags.byteLength + this.uniformColors.size * 8; // approximately 8 bytes per Map entry

    return {
      totalTiles: this.totalTiles,
      dirtyTiles: dirtyCount,
      uniformTiles: uniformCount,
      memoryUsage,
    };
  }
}
