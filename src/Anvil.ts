import { DiffsController } from './buffer/DiffsController';
import { RgbaBuffer, TransferOptions } from './buffer/RgbaBuffer';
import { TilesController } from './buffer/TilesController';
import { packedU32ToRgba, rgbaToPackedU32 } from './ops/Packing';
import { PackedDiffs } from './types/patch/Patch';
import { PackedWholePatchData } from './types/patch/whole';
import type { RawPixelData } from './types/rawBuffer';
import { toUint8ClampedArray } from './types/rawBuffer';
import type { PixelPatchData } from './types/patch/pixel';
import type { Point, RGBA, Size, TileIndex } from './types/types';

/**
 * Anvil - Main facade for pixel-based drawing operations
 *
 * Provides a unified interface for pixel manipulation, change tracking,
 * and performance optimization through tile-based management.
 */
export class Anvil {
  private buffer: RgbaBuffer;
  private tilesController: TilesController;
  private diffsController: DiffsController;
  private readonly tileSize: number;

  constructor(width: number, height: number, tileSize = 32) {
    this.tileSize = tileSize;

    // Initialize core components
    this.buffer = new RgbaBuffer(width, height);
    this.tilesController = new TilesController(this.buffer, width, height, tileSize);
    this.diffsController = new DiffsController();
  }

  // Basic properties
  getWidth(): number {
    return this.buffer.width;
  }

  getHeight(): number {
    return this.buffer.height;
  }

  /**
   * Exposes the underlying buffer handle for read-only operations (e.g. generating thumbnails).
   * Callers must not mutate the returned buffer directly.
   */
  getBufferHandle(): RgbaBuffer {
    return this.buffer;
  }

  exportWebp(): Uint8Array {
    return this.buffer.exportWebp();
  }

  exportPng(): Uint8Array {
    return this.buffer.exportPng();
  }

  importRaw(buffer: RawPixelData, width: number, height: number): boolean {
    const ok = this.buffer.importRaw(buffer, width, height);
    if (ok) {
      this.handleBufferMutation(width, height);
    }
    return ok;
  }

  importWebp(buffer: Uint8Array, width: number, height: number): boolean {
    const ok = this.buffer.importWebp(buffer, width, height);
    if (ok) {
      this.handleBufferMutation(width, height);
    }
    return ok;
  }

  importPng(buffer: Uint8Array, width: number, height: number): boolean {
    const ok = this.buffer.importPng(buffer, width, height);
    if (ok) {
      this.handleBufferMutation(width, height);
    }
    return ok;
  }

  sliceWithMask(mask: RawPixelData, maskWidth: number, maskHeight: number, offsetX = 0, offsetY = 0): Uint8ClampedArray {
    return this.buffer.sliceWithMask(mask, maskWidth, maskHeight, { offsetX, offsetY });
  }

  cropWithMask(mask: RawPixelData, maskWidth: number, maskHeight: number, offsetX = 0, offsetY = 0): Uint8ClampedArray {
    return this.buffer.cropWithMask(mask, maskWidth, maskHeight, { offsetX, offsetY });
  }

  transferFromRaw(source: RawPixelData, width: number, height: number, options?: TransferOptions): void {
    this.buffer.transferFromRaw(source, width, height, options);
    this.tilesController.setAllDirty();
  }

  resetBuffer(buffer?: RawPixelData): void {
    this.replaceBuffer(buffer ?? new Uint8ClampedArray(this.buffer.width * this.buffer.height * 4));
  }

  /**
   * Load existing image data into the anvil
   * @param buffer Existing pixel buffer to copy from
   */
  replaceBuffer(buffer: RawPixelData, width?: number, height?: number): void {
    if (width !== undefined && height !== undefined) {
      this.resize(width, height);
    }

    const expectedLength = this.buffer.width * this.buffer.height * 4;
    const clampedBuffer = toUint8ClampedArray(buffer);
    if (clampedBuffer.length !== expectedLength) {
      throw new Error(
        `Image data length ${clampedBuffer.length} does not match expected ${expectedLength}. Did you forget to resize anvil before replacing?`
      );
    }

    // Copy data to internal buffer
    this.buffer.data.set(clampedBuffer);

    this.handleBufferMutation(this.buffer.width, this.buffer.height);
  }

  setPartialBuffer(boundBox: { x: number; y: number; width: number; height: number }, source: RawPixelData): void {
    const { x, y, width: w, height: h } = boundBox;
    if (w <= 0 || h <= 0) return;
    this.buffer.writeRect(x, y, w, h, source);
  }

  getPartialBuffer(boundBox: { x: number; y: number; width: number; height: number }): Uint8ClampedArray {
    const { x, y, width: w, height: h } = boundBox;
    if (w <= 0 || h <= 0) {
      return new Uint8ClampedArray(0);
    }
    return this.buffer.readRect(x, y, w, h);
  }

  /**
   * Get the current buffer data (copy for safety)
   * @returns Copy of the current pixel buffer for safe external use
   */
  getBufferCopy(): Uint8ClampedArray {
    return new Uint8ClampedArray(this.buffer.data);
  }
  // Buffer access
  getBufferPointer(): Uint8ClampedArray {
    return this.buffer.data;
  }

  /**
   * Apply an effect that mutates the whole buffer while automatically capturing history.
   * Consumers just provide the mutator – this handles diff registration & dirty tiles.
   */
  applyWholeBufferEffect(effect: (buffer: RgbaBuffer) => void): void {
    // Capture the current buffer state for undo/redo before mutating it
    this.addWholeDiff(this.buffer.data);
    effect(this.buffer);
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
    this.diffsController.addPixel({ x, y, color: oldColor });
    const tileIndex = this.tilesController.pixelToTileIndex(x, y);
    this.checkTileUniformity(tileIndex);
  }

  setDirty(x: number, y: number): void {
    this.tilesController.markDirtyByPixel(x, y);
  }

  restorePixelDiffs(diffs: PixelPatchData[]): void {
    if (!diffs || diffs.length === 0) {
      return;
    }

    const coordBuffer = new Uint32Array(diffs.length * 2);
    const colorBuffer = new Uint8Array(diffs.length * 4);

    let coordIndex = 0;
    let colorIndex = 0;
    for (const diff of diffs) {
      coordBuffer[coordIndex++] = diff.x >>> 0;
      coordBuffer[coordIndex++] = diff.y >>> 0;

      colorBuffer[colorIndex++] = diff.color[0];
      colorBuffer[colorIndex++] = diff.color[1];
      colorBuffer[colorIndex++] = diff.color[2];
      colorBuffer[colorIndex++] = diff.color[3];

      this.setDirty(diff.x, diff.y);
    }

    this.buffer.writePixels(coordBuffer, colorBuffer);
  }

  private handleBufferMutation(newWidth: number, newHeight: number): void {
    this.tilesController.resize(newWidth, newHeight);
    this.tilesController.setAllDirty();
    this.diffsController.discard();
  }

  fillWithMaskArea(args: { mask: Uint8Array; color: RGBA }): boolean {
    return this.buffer.fillMaskArea(args.mask, args.color);
  }

  floodFill(args: {
    startX: number;
    startY: number;
    color: RGBA;
    threshold?: number;
    mask?: {
      buffer: Uint8Array;
      mode: 'inside' | 'outside' | 'none';
    };
  }): boolean {
    return this.buffer.floodFill(args.startX, args.startY, args.color, {
      threshold: args.threshold,
      mask: args.mask,
    });
  }

  private checkTileUniformity(tileIndex: { row: number; col: number }): void {
    // Use the tile controller's detectTileUniformity method
    this.tilesController.detectTileUniformity(tileIndex);
  }

  /**
   * @deprecated addWholeDiff should be replaced to this addCurrentWholeDiff.
   * Register a whole-buffer change (swap method) into diff tracking.
   * Marks all tiles dirty so renderer can refresh.
   */
  addWholeDiff(swapBuffer: RawPixelData): void {
    const clampedSwap = new Uint8ClampedArray(toUint8ClampedArray(swapBuffer));
    this.diffsController.addWhole({ swapBuffer: clampedSwap, width: this.getWidth(), height: this.getHeight() });
    this.tilesController.setAllDirty();
  }

  // addWholeDiff needed swapBuffer that refers to buffer before change,
  // but in swap method, calling it before change just means "save current buffer as swapBuffer".
  // so, addWholeDiff should be replaced to this addCurrentWholeDiff that captures current buffer as swapBuffer and immediately pack whole diff.
  addCurrentWholeDiff(): void {
    const currentPacked: PackedWholePatchData = {
      swapBufferWebp: this.buffer.exportWebp(),
      width: this.getWidth(),
      height: this.getHeight(),
    };
    this.diffsController.addWholePacked(currentPacked);
    this.tilesController.setAllDirty();
  }

  addPartialDiff(boundBox: { x: number; y: number; width: number; height: number }, swapBuffer: RawPixelData, setDirty?: boolean): void {
    const clampedSwap = toUint8ClampedArray(swapBuffer);
    this.diffsController.addPartial({ boundBox, swapBuffer: clampedSwap });

    if (setDirty) {
      const tileSize = this.getTileSize();
      const startTileX = Math.floor(boundBox.x / tileSize);
      const endTileX = Math.floor((boundBox.x + boundBox.width - 1) / tileSize);
      const startTileY = Math.floor(boundBox.y / tileSize);
      const endTileY = Math.floor((boundBox.y + boundBox.height - 1) / tileSize);
      for (let ty = startTileY; ty <= endTileY; ty++) {
        for (let tx = startTileX; tx <= endTileX; tx++) {
          this.tilesController.setDirty({ row: ty, col: tx }, true);
        }
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
    this.diffsController.discard();
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
    this.diffsController.discard();
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
      const currentBuffer = this.exportWebp();
      this.importWebp(patch.whole.swapBufferWebp, this.getWidth(), this.getHeight());
      patch.whole.swapBufferWebp = currentBuffer;
    }

    // Partial rectangle (swap method - applies after whole, before tiles/pixels)
    if (patch.partial) {
      const { boundBox, swapBufferWebp } = patch.partial;
      const decodedBuffer = RgbaBuffer.fromWebp(boundBox.width, boundBox.height, swapBufferWebp);
      const currentPartial = this.getPartialBuffer(boundBox);
      const currentBuffer = RgbaBuffer.fromRaw(boundBox.width, boundBox.height, currentPartial).exportWebp();
      this.setPartialBuffer(boundBox, new Uint8ClampedArray(decodedBuffer.data));
      // Update the patch to contain the previous buffer content for next swap
      patch.partial.swapBufferWebp = currentBuffer;
    }

    // Pixels
    patch.pixels = patch.pixels?.map((p) => {
      const colorUnpacked = packedU32ToRgba(p.color);

      const swapColor = this.getPixel(p.x, p.y);
      this.setPixel(p.x, p.y, colorUnpacked);
      return { x: p.x, y: p.y, color: rgbaToPackedU32(swapColor) };
    });

    this.tilesController.setAllDirty();
  }

  flushDiffs(): PackedDiffs | null {
    const patch = this.diffsController.flush();
    return patch || null;
  }

  discardDiffs(): void {
    this.diffsController.discard();
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

  setAllDirty(): void {
    this.tilesController.setAllDirty();
  }

  clearDirtyTiles(): void {
    this.tilesController.clearAllDirty();
  }
}
