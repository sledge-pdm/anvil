import { LayerDiffsController } from './buffer/LayerDiffsController';
import { LayerTilesController } from './buffer/LayerTilesController';
import { PixelBuffer } from './buffer/PixelBuffer';
import { packedU32ToRgba, rawToWebp, rgbaToPackedU32, webpToRaw } from './ops/packing/Packing';
import { PackedDiffs } from './types/patch/Patch';
import type { Point, RGBA, Size, TileIndex } from './types/types';

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
    this.tilesController = new LayerTilesController(this.buffer, width, height, tileSize);
    this.diffsController = new LayerDiffsController(this.tilesController, tileSize);
  }

  // Basic properties
  getWidth(): number {
    return this.buffer.width;
  }

  getHeight(): number {
    return this.buffer.height;
  }

  resetBuffer(buffer?: Uint8ClampedArray): void {
    this.replaceBuffer(buffer ?? new Uint8ClampedArray(this.buffer.width * this.buffer.height * 4));
  }
  /**
   * Load existing image data into the anvil
   * @param buffer Existing pixel buffer to copy from
   */
  replaceBuffer(buffer: Uint8ClampedArray, width?: number, height?: number): void {
    if (width !== undefined && height !== undefined) {
      console.log('resizing ', this.getWidth(), this.getHeight(), ' to ', width, height);
      this.resize(width, height);
      console.log('resized:  ', this.getWidth(), this.getHeight());
    }

    const expectedLength = this.buffer.width * this.buffer.height * 4;
    if (buffer.length !== expectedLength) {
      throw new Error(
        `Image data length ${buffer.length} does not match expected ${expectedLength}. Did you forget to resize anvil before replacing?`
      );
    }

    // Copy data to internal buffer
    this.buffer.data.set(buffer);

    // Reset all tracking states
    this.diffsController.discardPendingChanges();
    this.tilesController.setAllDirty();
  }

  setPartialBuffer(boundBox: { x: number; y: number; width: number; height: number }, source: Uint8ClampedArray): void {
    const { x, y, width: w, height: h } = boundBox;

    if (w > 0 && h > 0) {
      const buf = this.getBufferData();
      if (buf) {
        for (let row = 0; row < h; row++) {
          const sy = y + row;
          if (sy < 0 || sy >= this.getHeight()) continue;
          const srcOffset = row * w * 4;
          const dstOffset = (sy * this.getWidth() + x) * 4;
          // Clamp horizontal copy within layer bounds
          let copyW = w;
          let srcXOffset = 0;
          if (x < 0) {
            // shift source start
            const shift = -x;
            srcXOffset = shift * 4;
            copyW -= shift;
          }
          if (x + copyW > this.getWidth()) {
            copyW = this.getWidth() - x;
          }
          if (copyW <= 0) continue;
          buf.set(source.subarray(srcOffset + srcXOffset, srcOffset + srcXOffset + copyW * 4), dstOffset + srcXOffset);
        }
      }
    }
  }

  getPartialBuffer(boundBox: { x: number; y: number; width: number; height: number }): Uint8ClampedArray {
    const { x, y, width: w, height: h } = boundBox;
    const result = new Uint8ClampedArray(w * h * 4);

    if (w > 0 && h > 0) {
      const buf = this.getBufferData();
      if (buf) {
        for (let row = 0; row < h; row++) {
          const sy = y + row;
          if (sy < 0 || sy >= this.getHeight()) continue;
          const dstOffset = row * w * 4;
          const srcOffset = (sy * this.getWidth() + x) * 4;
          // Clamp horizontal copy within layer bounds
          let copyW = w;
          let srcXOffset = 0;
          if (x < 0) {
            // shift destination start
            const shift = -x;
            srcXOffset = shift * 4;
            copyW -= shift;
          }
          if (x + copyW > this.getWidth()) {
            copyW = this.getWidth() - x;
          }
          if (copyW <= 0) continue;
          result.set(buf.subarray(srcOffset + srcXOffset, srcOffset + srcXOffset + copyW * 4), dstOffset + srcXOffset);
        }
      }
    }

    return result;
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
      this.diffsController.addPixel({ x, y, color: oldColor });
    } else {
      this.tilesController.markDirtyByPixel(x, y);
      this.diffsController.addPixel({ x, y, color: oldColor });
      const tileIndex = this.tilesController.pixelToTileIndex(x, y);
      this.checkTileUniformity(tileIndex);
    }
  }

  setDirty(x: number, y: number): void {
    this.tilesController.markDirtyByPixel(x, y);
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
          this.diffsController.addTileFill({ tileIndex, before: oldColor, after: color });
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

  /**
   * Register a whole-buffer change (swap method) into diff tracking.
   * Marks all tiles dirty so renderer can refresh.
   */
  addWholeDiff(swapBuffer: Uint8ClampedArray): void {
    this.diffsController.addWhole({ swapBuffer, width: this.getWidth(), height: this.getHeight() });
    this.tilesController.setAllDirty();
  }

  /**
   * Register a partial rectangular diff (swap method). Caller provides replacement buffer.
   * Marks tiles overlapping the rectangle as dirty.
   */
  addPartialDiff(boundBox: { x: number; y: number; width: number; height: number }, swapBuffer: Uint8ClampedArray): void {
    // Use the diffsController's new public method
    this.diffsController.addPartial({ boundBox, swapBuffer });
    // Mark tiles dirty
    const startTileX = Math.floor(boundBox.x / this.tileSize);
    const startTileY = Math.floor(boundBox.y / this.tileSize);
    const endTileX = Math.floor((boundBox.x + boundBox.width - 1) / this.tileSize);
    const endTileY = Math.floor((boundBox.y + boundBox.height - 1) / this.tileSize);
    for (let ty = startTileY; ty <= endTileY; ty++) {
      for (let tx = startTileX; tx <= endTileX; tx++) {
        this.tilesController.markDirtyByPixel(tx * this.tileSize, ty * this.tileSize);
      }
    }
  }

  hasPendingChanges(): boolean {
    return this.diffsController.hasPendingChanges();
  }

  // Resize operations
  resize(newWidth: number, newHeight: number): void {
    const newSize: Size = { width: newWidth, height: newHeight };
    this.buffer.resize(newSize);
    this.tilesController.resize(newWidth, newHeight);
    // Note: This would invalidate current diffs, so we clear them
    this.diffsController.discardPendingChanges();
  }

  resizeWithOffset(
    newSize: Size,
    options?: {
      srcOrigin?: Point;
      destOrigin?: Point;
    }
  ): void {
    this.buffer.resize(newSize, options);
    this.tilesController.resize(newSize.width, newSize.height);
    // Note: This would invalidate current diffs, so we clear them
    this.diffsController.discardPendingChanges();
  }

  previewPatch(): PackedDiffs | null {
    const patch = this.diffsController.previewPatch();
    return (patch as PackedDiffs) || null;
  }

  applyPatch(patch: PackedDiffs | null, mode: 'undo' | 'redo') {
    if (!patch) {
      console.warn('applyPatch: patch is null');
      return;
    }

    // Whole buffer (swap method)
    if (patch.whole) {
      const rawBuffer = webpToRaw(patch.whole.swapBufferWebp, this.getWidth(), this.getHeight());
      const currentBuffer = rawToWebp(new Uint8Array(this.getBufferData().buffer), this.getWidth(), this.getHeight());
      this.replaceBuffer(new Uint8ClampedArray(rawBuffer.buffer));
      patch.whole.swapBufferWebp = currentBuffer;
    }

    // Partial rectangle (swap method - applies after whole, before tiles/pixels)
    if (patch.partial) {
      const { boundBox, swapBufferWebp } = patch.partial;
      const rawBuffer = webpToRaw(swapBufferWebp, boundBox.width, boundBox.height);
      const currentPartial = this.getPartialBuffer(boundBox);
      const currentBuffer = rawToWebp(new Uint8Array(currentPartial.buffer), boundBox.width, boundBox.height);
      this.setPartialBuffer(boundBox, new Uint8ClampedArray(rawBuffer.buffer));
      // Update the patch to contain the previous buffer content for next swap
      patch.partial.swapBufferWebp = currentBuffer;
    }

    // Tile fills
    patch.tiles?.forEach((t) => {
      let packed = mode === 'undo' ? t.before : t.after;
      if (mode === 'undo' && packed === undefined) {
        packed = 0; // transparent RGBA(0,0,0,0)
      }
      if (packed === undefined) return; // redo 方向で after が無いケースは無視
      const r = (packed >> 16) & 0xff;
      const g = (packed >> 8) & 0xff;
      const b = packed & 0xff;
      const a = (packed >>> 24) & 0xff;
      const tileSize = this.getTileSize();
      const ox = t.tileIndex.col * tileSize;
      const oy = t.tileIndex.row * tileSize;
      this.fillRect(ox, oy, tileSize, tileSize, [r, g, b, a]);
    });

    // Pixels
    patch.pixels = patch.pixels?.map((p) => {
      const colorUnpacked = packedU32ToRgba(p.color);

      const swapColor = this.getPixel(p.x, p.y);
      this.setPixel(p.x, p.y, colorUnpacked);
      return { x: p.x, y: p.y, color: rgbaToPackedU32(swapColor) };
    });

    this.flush();
    // TODO: set dirty depending on changed areas
    this.tilesController.setAllDirty();
  }

  flush(): PackedDiffs | null {
    const patch = this.diffsController.flush();
    this.tilesController.clearAllDirty();
    return (patch as PackedDiffs) || null;
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
}
