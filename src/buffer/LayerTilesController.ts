import { packedU32ToRgba, rgbaToPackedU32, tileIndexToLinear } from '../ops/packing/Packing.js';
import type { RGBA, TileBounds, TileIndex, TileInfo } from '../types/types.js';
import type { PixelBuffer } from './PixelBuffer.js';

/**
 * Controller: High-level tile operations and pixel-to-tile coordination
 * Responsible for: business logic, buffer integration, uniform detection
 */
export class LayerTilesController {
  public readonly tileSize: number;
  public rows: number;
  public cols: number;
  public totalTiles: number;

  // Bitset storage for flags (more memory efficient than boolean arrays)
  private dirtyFlags: Uint32Array;
  private uniformFlags: Uint32Array;

  // Sparse storage for uniform colors (only store when tile is uniform)
  private uniformColors: Map<number, number> = new Map(); // tileIndex -> packed RGBA32

  constructor(
    private buffer: PixelBuffer,
    width: number,
    height: number,
    tileSize = 32
  ) {
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
   * Mark tile dirty by pixel coordinates
   */
  markDirtyByPixel(x: number, y: number): void {
    const tileIndex = this.pixelToTileIndex(x, y);
    this.setDirty(tileIndex, true);

    // If tile was uniform, it's no longer uniform after pixel change
    if (this.isUniform(tileIndex)) {
      this.setUniform(tileIndex, false);
    }
  }

  /**
   * Fill entire tile with uniform color
   * Returns the previous uniform color if it was uniform, undefined otherwise
   */
  fillTile(tileIndex: TileIndex, color: RGBA): RGBA | undefined {
    if (!this.isValidTileIndex(tileIndex)) return undefined;

    const previousColor = this.getUniformColor(tileIndex);
    const bounds = this.getTileBounds(tileIndex);

    // Fill the buffer area
    for (let ty = 0; ty < bounds.height; ty++) {
      for (let tx = 0; tx < bounds.width; tx++) {
        const x = bounds.x + tx;
        const y = bounds.y + ty;

        if (this.buffer.isInBounds(x, y)) {
          this.buffer.set(x, y, color);
        }
      }
    }

    // Mark as uniform and dirty
    this.setUniform(tileIndex, true, color);
    this.setDirty(tileIndex, true);

    return previousColor;
  }

  /**
   * Check if a tile is actually uniform by sampling the buffer
   * (useful for validation or after manual buffer modifications)
   */
  detectTileUniformity(tileIndex: TileIndex): boolean {
    if (!this.isValidTileIndex(tileIndex)) return false;

    const bounds = this.getTileBounds(tileIndex);
    let firstColor: RGBA | undefined = undefined;

    for (let ty = 0; ty < bounds.height; ty++) {
      for (let tx = 0; tx < bounds.width; tx++) {
        const x = bounds.x + tx;
        const y = bounds.y + ty;

        if (!this.buffer.isInBounds(x, y)) continue;

        const color = this.buffer.get(x, y);

        if (!firstColor) {
          firstColor = color;
        } else if (color[0] !== firstColor[0] || color[1] !== firstColor[1] || color[2] !== firstColor[2] || color[3] !== firstColor[3]) {
          return false; // Not uniform
        }
      }
    }

    // Update internal state to match reality
    if (firstColor) {
      this.setUniform(tileIndex, true, firstColor);
    }

    return true;
  }

  /**
   * Validate all tiles' uniformity against buffer contents
   * (expensive operation - mainly for debugging/testing)
   */
  validateAllTileUniformity(): void {
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        this.detectTileUniformity({ row, col });
      }
    }
  }

  getRows(): number {
    return this.rows;
  }
  getCols(): number {
    return this.cols;
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

  /**
   * Get all dirty tile information
   */
  getDirtyTiles(): TileInfo[] {
    const result: TileInfo[] = [];
    this.forEachDirty((info) => result.push(info));
    return result;
  }

  /**
   * Resize tile grid to match new buffer dimensions
   */
  resize(newWidth: number, newHeight: number): void {
    const oldCols = this.cols;
    const oldRows = this.rows;
    // Create new tile grid
    this.cols = Math.ceil(newWidth / this.tileSize);
    this.rows = Math.ceil(newHeight / this.tileSize);
    this.totalTiles = this.rows * this.cols;

    // Allocate bitsets (32 tiles per uint32)
    const flagArraySize = Math.ceil(this.totalTiles / 32);
    this.dirtyFlags = new Uint32Array(flagArraySize);
    this.uniformFlags = new Uint32Array(flagArraySize);

    // Copy over existing tile states where they overlap
    const minRows = Math.min(oldRows, this.rows);
    const minCols = Math.min(oldCols, this.cols);

    for (let row = 0; row < minRows; row++) {
      for (let col = 0; col < minCols; col++) {
        const index = { row, col };
        const oldInfo = this.getTileInfo(index);

        if (oldInfo.isDirty) {
          this.setDirty(index, true);
        }
        if (oldInfo.isUniform && oldInfo.uniformColor) {
          this.setUniform(index, true, oldInfo.uniformColor);
        }
      }
    }
  }
}
