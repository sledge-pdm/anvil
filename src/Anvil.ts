import { PixelBuffer } from './buffer/PixelBuffer';
import { LayerDiffs } from './buffer/diff/LayerDiffs';
import { LayerDiffsController } from './buffer/diff/LayerDiffsController';
import { LayerTiles } from './buffer/tile/LayerTiles';
import { LayerTilesController } from './buffer/tile/LayerTilesController';
import type { LayerPatch, Point, RGBA, Size, TileIndex } from './types';

/**
 * Anvil - Main facade for pixel-based drawing operations
 *
 * Provides a unified interface for pixel manipulation, change tracking,
 * and performance optimization through tile-based management.
 */
export class Anvil {
  private buffer: PixelBuffer;
  private tilesController: LayerTilesController;
  private diffsController: LayerDiffsController;
  private readonly tileSize: number;
  // Batch mode flags/state
  private _batchDepth = 0; // ネスト対応（念のため）
  private _batchDirtyTiles: Set<string> | null = null;
  private _batchUniformCheckTiles: Set<string> | null = null;

  constructor(width: number, height: number, tileSize = 32) {
    this.tileSize = tileSize;

    // Initialize core components
    this.buffer = new PixelBuffer(width, height);
    this.tilesController = new LayerTilesController(new LayerTiles(width, height, tileSize), this.buffer);
    this.diffsController = new LayerDiffsController(new LayerDiffs(), this.tilesController, tileSize);
  }

  // Basic properties
  getWidth(): number {
    return this.buffer.width;
  }

  getHeight(): number {
    return this.buffer.height;
  }

  /**
   * Load existing image data into the anvil
   * @param imageData Existing pixel buffer to copy from
   */
  loadImageData(imageData: Uint8ClampedArray): void {
    const expectedLength = this.buffer.width * this.buffer.height * 4;
    if (imageData.length !== expectedLength) {
      throw new Error(`Image data length ${imageData.length} does not match expected ${expectedLength}`);
    }

    // Copy data to internal buffer
    this.buffer.data.set(imageData);

    // Reset all tracking states
    this.diffsController.clearDiffs();
    this.tilesController.setAllDirty();
  }

  /**
   * Get the current buffer data
   * @returns Copy of the current pixel buffer
   */
  getImageData(): Uint8ClampedArray {
    return new Uint8ClampedArray(this.buffer.data);
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
    if (this._batchDepth > 0) {
      // defer tile + uniform detection
      const tileIndex = this.tilesController.pixelToTileIndex(x, y);
      const key = tileIndex.row + ',' + tileIndex.col;
      this._batchDirtyTiles?.add(key);
      // uniform チェックはバッチ終端でまとめて再判定するので候補として保持
      this._batchUniformCheckTiles?.add(key);
      this.diffsController.addPixel(x, y, oldColor, color);
    } else {
      this.tilesController.markDirtyByPixel(x, y);
      this.diffsController.addPixel(x, y, oldColor, color);
      const tileIndex = this.tilesController.pixelToTileIndex(x, y);
      this.checkTileUniformity(tileIndex);
    }
  }

  private checkTileUniformity(tileIndex: { row: number; col: number }): void {
    // Use the tile controller's detectTileUniformity method
    this.tilesController.detectTileUniformity(tileIndex);
  }

  // Fill operations
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

  addPixelDiff(x: number, y: number, before: RGBA, after: RGBA): void {
    this.diffsController.addPixel(x, y, before, after);
  }

  /**
   * Bulk pixel diffs 登録用補助。Anvil 外で manualDiff で直接 buffer を書いた後、before/after をまとめて登録。
   * batch 中でも利用可能。
   */
  addPixelDiffs(diffs: Array<{ x: number; y: number; before: RGBA; after: RGBA }>): void {
    for (const d of diffs) {
      // diff 登録
      this.diffsController.addPixel(d.x, d.y, d.before, d.after);
      if (this._batchDepth > 0) {
        const tileIndex = this.tilesController.pixelToTileIndex(d.x, d.y);
        const key = tileIndex.row + ',' + tileIndex.col;
        this._batchDirtyTiles?.add(key);
        this._batchUniformCheckTiles?.add(key);
      } else {
        this.tilesController.markDirtyByPixel(d.x, d.y);
        const tileIndex = this.tilesController.pixelToTileIndex(d.x, d.y);
        this.checkTileUniformity(tileIndex);
      }
    }
  }

  addTileFillDiff(tile: TileIndex, before: RGBA | undefined, after: RGBA): void {
    this.diffsController.addTileFill(tile, before, after);
  }

  /**
   * Register a whole-buffer change (before/after) into diff tracking.
   * Marks all tiles dirty so renderer can refresh.
   */
  addWholeDiff(before: Uint8ClampedArray, after: Uint8ClampedArray): void {
    if (before.length !== after.length) throw new Error('addWholeBufferChange: length mismatch');
    this.diffsController.addWholeBufferChange(before, after);
    this.tilesController.setAllDirty();
  }

  // Resize operations
  resize(newWidth: number, newHeight: number): void {
    const newSize: Size = { width: newWidth, height: newHeight };
    this.buffer.resize(newSize);
    this.tilesController.resize(newWidth, newHeight);
    // Note: This would invalidate current diffs, so we clear them
    this.diffsController.clearDiffs();
  }

  resizeWithOffset(newWidth: number, newHeight: number, offsetX: number, offsetY: number): void {
    const newSize: Size = { width: newWidth, height: newHeight };
    const destOrigin: Point = { x: offsetX, y: offsetY };
    this.buffer.resize(newSize, { destOrigin });
    this.tilesController.resize(newWidth, newHeight);
    // Note: This would invalidate current diffs, so we clear them
    this.diffsController.clearDiffs();
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

  /**
   * Start batch mode: tile dirty/uniform 判定を遅延させる。
   * ネスト可能。既にバッチ中ならカウンタのみ増やす。
   */
  beginBatch(): void {
    if (this._batchDepth === 0) {
      this._batchDirtyTiles = new Set();
      this._batchUniformCheckTiles = new Set();
    }
    this._batchDepth++;
  }

  /**
   * End batch: 0 に戻ったタイミングでまとめて tile dirty と uniformity 再判定。
   */
  endBatch(): void {
    if (this._batchDepth === 0) return;
    this._batchDepth--;
    if (this._batchDepth > 0) return; // まだネスト内

    const dirty = this._batchDirtyTiles!;
    const uni = this._batchUniformCheckTiles!;
    this._batchDirtyTiles = null;
    this._batchUniformCheckTiles = null;

    // Dirty 適用 (uniformity は後でまとめて判定)
    for (const key of dirty) {
      const [row, col] = key.split(',').map((v) => parseInt(v, 10));
      this.tilesController.markDirtyByPixel(row * this.tileSize, col * this.tileSize); // 任意のピクセルで dirty 化
    }
    // uniformity 再チェック
    for (const key of uni) {
      const [row, col] = key.split(',').map((v) => parseInt(v, 10));
      this.checkTileUniformity({ row, col });
    }
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

  /**
   * Clear all dirty tile flags (typically after renderer finishes uploading).
   * Note: flush() already clears dirty flags when producing a patch, but
   * full texture uploads (e.g. initial frame, resize) may require manual clear.
   */
  clearDirtyTiles(): void {
    this.tilesController.clearAllDirty();
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
