import { PixelBuffer } from './buffer/PixelBuffer';
import { LayerDiffs } from './diff/LayerDiffs';
import { LayerDiffsController } from './diff/LayerDiffsController';
import { LayerTiles } from './tile/LayerTiles';
import { LayerTilesController } from './tile/LayerTilesController';
import type { LayerPatch, Point, RGBA, Size, TileIndex } from './types';

/**
 * Anvil - Main facade for pixel-based drawing operations
 *
 * Provides a unified interface for pixel manipulation, change tracking,
 * and performance optimization through tile-based management.
 */
export class Anvil {
  private buffer: PixelBuffer;
  private tiles: LayerTiles;
  private tilesController: LayerTilesController;
  private diffs: LayerDiffs;
  private diffsController: LayerDiffsController;
  private readonly tileSize: number;

  constructor(width: number, height: number, tileSize = 32) {
    this.tileSize = tileSize;

    // Initialize core components
    this.buffer = new PixelBuffer(width, height);
    this.tiles = new LayerTiles(width, height, tileSize);
    this.tilesController = new LayerTilesController(this.tiles, this.buffer);
    this.diffs = new LayerDiffs();
    this.diffsController = new LayerDiffsController(this.diffs, this.tilesController, tileSize);
  }

  // Basic properties
  getWidth(): number {
    return this.buffer.width;
  }

  getHeight(): number {
    return this.buffer.height;
  }

  getTileSize(): number {
    return this.tileSize;
  }

  // Pixel operations
  getPixel(x: number, y: number): RGBA {
    if (!this.buffer.isInBounds(x, y)) {
      throw new Error(`Pixel coordinates (${x}, ${y}) are out of bounds`);
    }
    return this.buffer.get(x, y);
  }

  setPixel(x: number, y: number, color: RGBA): void {
    if (!this.buffer.isInBounds(x, y)) {
      throw new Error(`Pixel coordinates (${x}, ${y}) are out of bounds`);
    }

    const oldColor = this.buffer.get(x, y);
    this.buffer.set(x, y, color);
    this.tilesController.markDirtyByPixel(x, y);
    this.diffsController.addPixel(x, y, oldColor, color);

    // Check if the tile might have become uniform after this change
    const tileIndex = this.tiles.pixelToTileIndex(x, y);
    this.checkTileUniformity(tileIndex);
  }

  private checkTileUniformity(tileIndex: { row: number; col: number }): void {
    // Use the tile controller's detectTileUniformity method
    this.tilesController.detectTileUniformity(tileIndex);
  } // Fill operations
  fillRect(x: number, y: number, width: number, height: number, color: RGBA): void {
    if (width <= 0 || height <= 0) return;

    // Check if this fill operation covers entire tiles
    const startTileX = Math.floor(x / this.tileSize);
    const startTileY = Math.floor(y / this.tileSize);
    const endTileX = Math.floor((x + width - 1) / this.tileSize);
    const endTileY = Math.floor((y + height - 1) / this.tileSize);

    // Optimize: if fill covers entire tiles exactly
    const tilesWide = Math.ceil(this.getWidth() / this.tileSize);
    const tilesHigh = Math.ceil(this.getHeight() / this.tileSize);

    for (let tileY = startTileY; tileY <= endTileY; tileY++) {
      for (let tileX = startTileX; tileX <= endTileX; tileX++) {
        if (tileX >= tilesWide || tileY >= tilesHigh) continue;

        const tileStartX = tileX * this.tileSize;
        const tileStartY = tileY * this.tileSize;
        const tileEndX = Math.min(tileStartX + this.tileSize, this.getWidth());
        const tileEndY = Math.min(tileStartY + this.tileSize, this.getHeight());

        // Check if this fill completely covers this tile
        if (x <= tileStartX && y <= tileStartY && x + width >= tileEndX && y + height >= tileEndY) {
          // Tile is completely covered - use tile fill optimization
          const tileIndex = { row: tileY, col: tileX };
          const oldColor = this.tilesController.getTileInfo(tileIndex).uniformColor || ([0, 0, 0, 0] as RGBA);

          this.tilesController.fillTile(tileIndex, color);
          this.diffsController.addTileFill(tileIndex, oldColor, color);
        } else {
          // Tile is partially covered - fill individual pixels
          for (let py = Math.max(y, tileStartY); py < Math.min(y + height, tileEndY); py++) {
            for (let px = Math.max(x, tileStartX); px < Math.min(x + width, tileEndX); px++) {
              this.setPixel(px, py, color);
            }
          }
        }
      }
    }
  }

  fillAll(color: RGBA): void {
    this.fillRect(0, 0, this.getWidth(), this.getHeight(), color);
  }

  // Buffer access
  getBufferData(): Uint8ClampedArray {
    return this.buffer.data;
  }

  // Resize operations
  resize(newWidth: number, newHeight: number): void {
    const newSize: Size = { width: newWidth, height: newHeight };
    this.buffer.resize(newSize);
    this.tilesController.resize(newWidth, newHeight);
    // Note: This would invalidate current diffs, so we clear them
    this.diffs.clear();
  }

  resizeWithOffset(newWidth: number, newHeight: number, offsetX: number, offsetY: number): void {
    const newSize: Size = { width: newWidth, height: newHeight };
    const destOrigin: Point = { x: offsetX, y: offsetY };
    this.buffer.resize(newSize, { destOrigin });
    this.tilesController.resize(newWidth, newHeight);
    // Note: This would invalidate current diffs, so we clear them
    this.diffs.clear();
  }

  // Change tracking
  hasPendingChanges(): boolean {
    return this.diffs.hasPendingChanges();
  }

  getPendingPixelCount(): number {
    return this.diffsController.getPendingPixelCount();
  }

  previewPatch(): LayerPatch | null {
    const patch = this.diffsController.previewPatch();
    return (patch as LayerPatch) || null;
  }

  flush(): LayerPatch | null {
    const patch = this.diffsController.flush();
    this.tilesController.clearAllDirty();
    return (patch as LayerPatch) || null;
  }

  discardPendingChanges(): void {
    this.diffsController.discardPendingChanges();
  }

  // Tile management
  getTileInfo() {
    const tilesWide = Math.ceil(this.getWidth() / this.tileSize);
    const tilesHigh = Math.ceil(this.getHeight() / this.tileSize);
    return {
      tilesWide,
      tilesHigh,
      totalTiles: tilesWide * tilesHigh,
      tileSize: this.tileSize,
    };
  }

  getDirtyTileIndices(): TileIndex[] {
    return this.tilesController.getDirtyTiles().map((info) => info.index);
  }

  getTileUniformColor(tileIndex: TileIndex): RGBA | null {
    const tileInfo = this.tilesController.getTileInfo(tileIndex);
    return tileInfo.uniformColor || null;
  }

  // Debug and diagnostics
  getDebugInfo() {
    const bufferSize = this.getWidth() * this.getHeight() * 4;
    const diffsDebug = this.diffsController.getDebugInfo();

    return {
      width: this.getWidth(),
      height: this.getHeight(),
      tileSize: this.tileSize,
      bufferSize,
      ...diffsDebug,
      tileInfo: this.getTileInfo(),
    };
  }
}
