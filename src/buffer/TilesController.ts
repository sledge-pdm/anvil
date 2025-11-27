import { tileIndexToLinear } from '../ops/Packing.js';
import type { TileBounds, TileIndex, TileInfo } from '../types/types.js';
import { RgbaBuffer } from '../wasm/pkg/anvil_wasm.js';

/**
 * Controller: High-level tile operations and pixel-to-tile coordination
 * Responsible for: business logic, buffer integration, uniform detection
 */
export class TilesController {
  public readonly tileSize: number;
  public rows: number;
  public cols: number;
  public totalTiles: number;

  // Bitset storage for flags (more memory efficient than boolean arrays)
  private dirtyFlags: Uint32Array;

  constructor(
    private buffer: RgbaBuffer,
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
  }

  /**
   * Mark tile dirty by pixel coordinates
   */
  markDirtyByPixel(x: number, y: number): void {
    const tileIndex = this.pixelToTileIndex(x, y);
    this.setDirty(tileIndex, true);
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
    const x = index.col * this.tileSize;
    const y = index.row * this.tileSize;

    const maxWidth = this.buffer.width();
    const maxHeight = this.buffer.height();

    const width = Math.min(this.tileSize, maxWidth - x);
    const height = Math.min(this.tileSize, maxHeight - y);

    return {
      x,
      y,
      width: Math.max(0, width),
      height: Math.max(0, height),
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
   * Get complete tile information
   */
  getTileInfo(index: TileIndex): TileInfo {
    return {
      index,
      bounds: this.getTileBounds(index),
      isDirty: this.isDirty(index),
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
      }
    }
  }
}
