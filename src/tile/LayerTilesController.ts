import type { PixelBuffer } from '../buffer/PixelBuffer.js';
import type { RGBA, TileIndex, TileInfo } from '../types.js';
import { LayerTiles } from './LayerTiles.js';

/**
 * Controller: High-level tile operations and pixel-to-tile coordination
 * Responsible for: business logic, buffer integration, uniform detection
 */
export class LayerTilesController {
  constructor(
    private tiles: LayerTiles,
    private buffer: PixelBuffer
  ) {}

  /**
   * Mark tile dirty by pixel coordinates
   */
  markDirtyByPixel(x: number, y: number): void {
    const tileIndex = this.tiles.pixelToTileIndex(x, y);
    this.tiles.setDirty(tileIndex, true);

    // If tile was uniform, it's no longer uniform after pixel change
    if (this.tiles.isUniform(tileIndex)) {
      this.tiles.setUniform(tileIndex, false);
    }
  }

  /**
   * Fill entire tile with uniform color
   * Returns the previous uniform color if it was uniform, undefined otherwise
   */
  fillTile(tileIndex: TileIndex, color: RGBA): RGBA | undefined {
    if (!this.tiles.isValidTileIndex(tileIndex)) return undefined;

    const previousColor = this.tiles.getUniformColor(tileIndex);
    const bounds = this.tiles.getTileBounds(tileIndex);

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
    this.tiles.setUniform(tileIndex, true, color);
    this.tiles.setDirty(tileIndex, true);

    return previousColor;
  }

  /**
   * Check if a tile is actually uniform by sampling the buffer
   * (useful for validation or after manual buffer modifications)
   */
  detectTileUniformity(tileIndex: TileIndex): boolean {
    if (!this.tiles.isValidTileIndex(tileIndex)) return false;

    const bounds = this.tiles.getTileBounds(tileIndex);
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
      this.tiles.setUniform(tileIndex, true, firstColor);
    }

    return true;
  }

  /**
   * Validate all tiles' uniformity against buffer contents
   * (expensive operation - mainly for debugging/testing)
   */
  validateAllTileUniformity(): void {
    for (let row = 0; row < this.tiles.rows; row++) {
      for (let col = 0; col < this.tiles.cols; col++) {
        this.detectTileUniformity({ row, col });
      }
    }
  }

  /**
   * Get tile information with current buffer state
   */
  getTileInfo(index: TileIndex): TileInfo {
    return this.tiles.getTileInfo(index);
  }

  /**
   * Get all dirty tile information
   */
  getDirtyTiles(): TileInfo[] {
    const result: TileInfo[] = [];
    this.tiles.forEachDirty((info) => result.push(info));
    return result;
  }

  /**
   * Clear all dirty flags
   */
  clearAllDirty(): void {
    this.tiles.clearAllDirty();
  }

  /**
   * Mark all tiles as dirty (for full refresh)
   */
  setAllDirty(): void {
    this.tiles.setAllDirty();
  }

  /**
   * Resize tile grid to match new buffer dimensions
   */
  resize(newWidth: number, newHeight: number): void {
    // Create new tile grid
    const newTiles = new LayerTiles(newWidth, newHeight, this.tiles.tileSize);

    // Copy over existing tile states where they overlap
    const minRows = Math.min(this.tiles.rows, newTiles.rows);
    const minCols = Math.min(this.tiles.cols, newTiles.cols);

    for (let row = 0; row < minRows; row++) {
      for (let col = 0; col < minCols; col++) {
        const index = { row, col };
        const oldInfo = this.tiles.getTileInfo(index);

        if (oldInfo.isDirty) {
          newTiles.setDirty(index, true);
        }
        if (oldInfo.isUniform && oldInfo.uniformColor) {
          newTiles.setUniform(index, true, oldInfo.uniformColor);
        }
      }
    }

    // Replace internal tiles instance
    (this as any).tiles = newTiles;
  }

  /**
   * Get statistics including buffer-derived info
   */
  getStats() {
    return this.tiles.getStats();
  }
}
