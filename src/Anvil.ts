import { DiffsController } from './buffer/DiffsController';
import { TilesController } from './buffer/TilesController';
import type { RGBA } from './models/RGBA';
import { packedU32ToRgba, rgbaToPackedU32 } from './ops/Packing';
import type { PackedDiffs } from './types/patch/Patch';
import type { PixelPatchData } from './types/patch/pixel';
import type { PackedWholePatchData } from './types/patch/whole';
import type { RawPixelData } from './types/rawBuffer';
import { toUint8Array, toUint8ClampedArray } from './types/rawBuffer';
import type { Point, Size, TileIndex } from './types/types';
import { RgbaBuffer } from './wasm/pkg/anvil_wasm';
import { AntialiasMode } from './wasm/pkg/anvil_wasm_bg';

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
    return this.buffer.width();
  }

  getHeight(): number {
    return this.buffer.height();
  }

  /**
   * Exposes the underlying buffer handle for read-only operations (e.g. generating thumbnails).
   * !! Callers must not mutate the returned buffer directly. !!
   */
  dangerouslyGetBufferHandle(): RgbaBuffer {
    return this.buffer;
  }

  exportWebp(): Uint8Array {
    return this.buffer.exportWebp();
  }

  exportPng(): Uint8Array {
    return this.buffer.exportPng();
  }

  importRaw(buffer: RawPixelData, width: number, height: number): boolean {
    const ok = this.buffer.importRaw(toUint8Array(buffer), width, height);
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

  // sliceWithMask(mask: RawPixelData, maskWidth: number, maskHeight: number, offsetX = 0, offsetY = 0): Uint8ClampedArray {
  //   this.buffer.sliceWithMask(toUint8Array(mask), maskWidth, maskHeight, offsetX, offsetY);
  //   return this.buffer.data();
  // }

  // cropWithMask(mask: RawPixelData, maskWidth: number, maskHeight: number, offsetX = 0, offsetY = 0): Uint8ClampedArray {
  //   this.buffer.cropWithMask(toUint8Array(mask), maskWidth, maskHeight, offsetX, offsetY);
  //   return this.buffer.data();
  // }

  transferFromRaw(source: RawPixelData, width: number, height: number, options?: TransferOptions): void {
    const view = toUint8Array(source);
    const {
      offsetX = 0,
      offsetY = 0,
      scaleX = 1,
      scaleY = 1,
      rotate = 0,
      flipX = false,
      flipY = false,
      antialiasMode = AntialiasMode.Nearest,
    } = options ?? {};
    this.buffer.blitFromRaw(view, width, height, offsetX, offsetY, scaleX, scaleY, rotate, antialiasMode, flipX, flipY);
    this.tilesController.setAllDirty();
  }

  resetBuffer(buffer?: RawPixelData): void {
    this.replaceBuffer(buffer ?? new Uint8ClampedArray(this.buffer.width() * this.buffer.height() * 4));
  }

  /**
   * Load existing image data into the anvil
   * @param buffer Existing pixel buffer to copy from
   */
  replaceBuffer(buffer: RawPixelData, width?: number, height?: number): void {
    if (width !== undefined && height !== undefined) {
      this.resize(width, height);
      return;
    }

    const expectedLength = this.buffer.width() * this.buffer.height() * 4;
    const clampedBuffer = toUint8ClampedArray(buffer);
    if (clampedBuffer.length !== expectedLength) {
      throw new Error(
        `Image data length ${clampedBuffer.length} does not match expected ${expectedLength}. Did you forget to resize anvil before replacing?`
      );
    }

    // Copy data to internal buffer
    this.buffer.overwriteWith(toUint8Array(clampedBuffer), this.buffer.width(), this.buffer.height());
    this.handleBufferMutation(this.buffer.width(), this.buffer.height());
  }

  setPartialBuffer(boundBox: { x: number; y: number; width: number; height: number }, source: RawPixelData): void {
    const { x, y, width: w, height: h } = boundBox;
    if (w <= 0 || h <= 0) return;
    this.buffer.writeRect(x, y, w, h, toUint8Array(source));
  }

  getPartialBuffer(boundBox: { x: number; y: number; width: number; height: number }): Uint8ClampedArray {
    const { x, y, width: w, height: h } = boundBox;
    if (w <= 0 || h <= 0) {
      return new Uint8ClampedArray(0);
    }
    return toUint8ClampedArray(this.buffer.readRect(x, y, w, h));
  }

  /**
   * Get the current buffer data (copy for safety)
   * @returns Copy of the current pixel buffer for safe external use
   */
  getBufferCopy(): Uint8ClampedArray {
    return new Uint8ClampedArray(this.buffer.data());
  }
  // Buffer access
  getBufferPointer(): Uint8ClampedArray {
    return toUint8ClampedArray(this.buffer.data());
  }

  /**
   * Apply an effect that mutates the whole buffer while automatically capturing history.
   * Consumers just provide the mutator – this handles diff registration & dirty tiles.
   */
  applyWholeBufferEffect(effect: (buffer: RgbaBuffer) => void): void {
    // Capture the current buffer state for undo/redo before mutating it
    this.addWholeDiff(this.buffer.data());
    effect(this.buffer);
  }

  getTileSize(): number {
    return this.tileSize;
  }

  getPixel(x: number, y: number): RGBA {
    if (!this.buffer.isInBounds(x, y)) {
      throw new Error(`Pixel coordinates (${x}, ${y}) are out of bounds`);
    }
    const color: Uint8ClampedArray = this.buffer.get(x, y);
    return [color[0], color[1], color[2], color[3]];
  }

  setPixel(x: number, y: number, color: RGBA, noDiff?: boolean): void {
    if (!this.buffer.isInBounds(x, y)) {
      throw new Error(`Pixel coordinates (${x}, ${y}) are out of bounds`);
    }
    const oldColor: Uint8ClampedArray = this.buffer.get(x, y);
    const oldColorRGBA: RGBA = [oldColor[0], oldColor[1], oldColor[2], oldColor[3]];

    this.buffer.set(x, y, ...color);

    this.tilesController.markDirtyByPixel(x, y);
    if (!noDiff) this.diffsController.addPixel({ x, y, color: oldColorRGBA });
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
    return this.buffer.fillMaskArea(args.mask, ...args.color);
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
    if (args.mask) {
      return this.buffer.floodFillWithMask(args.startX, args.startY, ...args.color, args.threshold ?? 0, args.mask.buffer, args.mask.mode);
    } else {
      return this.buffer.floodFill(args.startX, args.startY, ...args.color, args.threshold ?? 0);
    }
  }

  /*
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
    this.buffer.resize_with_origins(newSize.width, newSize.height, 0, 0, 0, 0);
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
    const srcOrigin = options?.srcOrigin ?? { x: 0, y: 0 };
    const destOrigin = options?.destOrigin ?? { x: 0, y: 0 };

    this.buffer.resize_with_origins(newSize.width, newSize.height, srcOrigin.x, srcOrigin.y, destOrigin.x, destOrigin.y);
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
      const decodedBuffer = new RgbaBuffer(boundBox.width, boundBox.height);
      decodedBuffer.importWebp(swapBufferWebp, boundBox.width, boundBox.height);

      const currentPartial = this.getPartialBuffer(boundBox);
      const currentBuffer = new RgbaBuffer(boundBox.width, boundBox.height);
      currentBuffer.importRaw(toUint8Array(currentPartial), boundBox.width, boundBox.height);

      const decoded = currentBuffer.exportWebp();

      this.setPartialBuffer(boundBox, decodedBuffer.data());
      // Update the patch to contain the previous buffer content for next swap
      patch.partial.swapBufferWebp = decoded;
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

  getDirtyTiles(): TileIndex[] {
    return this.tilesController.getDirtyTiles().map((info) => info.index);
  }

  setAllDirty(): void {
    this.tilesController.setAllDirty();
  }

  clearDirtyTiles(): void {
    this.tilesController.clearAllDirty();
  }
}

export interface TransferOptions {
  scaleX?: number;
  scaleY?: number;
  rotate?: number;
  offsetX?: number;
  offsetY?: number;
  flipX?: boolean;
  flipY?: boolean;
  antialiasMode?: AntialiasMode;
}

export interface MaskOptions {
  offsetX?: number;
  offsetY?: number;
}
