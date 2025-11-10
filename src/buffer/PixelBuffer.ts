import { AntialiasMode, RgbaBuffer } from '../ops_wasm/pkg/anvil_ops_wasm.js';
import type { Point, RGBA, Size } from '../types/types.js';

/**
 * Core pixel buffer operations - raw RGBA8 array management
 * Model responsibility: owns buffer state, provides bounds-checked access
 */
export class PixelBuffer {
  public width: number;
  public height: number;
  private wasmBuffer: RgbaBuffer;
  private dataView!: Uint8ClampedArray;

  constructor(width: number, height: number, initialData?: Uint8ClampedArray) {
    this.width = width;
    this.height = height;
    this.wasmBuffer = new RgbaBuffer(width, height);
    this.refreshDataView();

    if (initialData) {
      if (initialData.length !== width * height * 4) {
        throw new Error(`Buffer size mismatch: expected ${width * height * 4}, got ${initialData.length}`);
      }
      this.data.set(initialData);
    } else if (this.data.length !== width * height * 4) {
      throw new Error(`Buffer size mismatch: expected ${width * height * 4}, got ${this.data.length}`);
    }
  }

  public get data(): Uint8ClampedArray {
    return this.ensureDataView();
  }

  private static toClampedView(buffer: Uint8Array | Uint8ClampedArray): Uint8ClampedArray {
    if (buffer instanceof Uint8ClampedArray) {
      if (buffer.byteOffset === 0 && buffer.byteLength === buffer.buffer.byteLength) {
        return buffer;
      }
      return new Uint8ClampedArray(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    }
    return new Uint8ClampedArray(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  private static toUint8View(buffer: Uint8Array | Uint8ClampedArray): Uint8Array {
    if (buffer instanceof Uint8Array) {
      return buffer;
    }
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  static fromRaw(width: number, height: number, rawBuffer: Uint8Array | Uint8ClampedArray): PixelBuffer {
    return new PixelBuffer(width, height, PixelBuffer.toClampedView(rawBuffer));
  }

  static fromWebp(width: number, height: number, webpBuffer: Uint8Array): PixelBuffer {
    const buffer = new PixelBuffer(width, height);
    buffer.importWebp(webpBuffer, width, height);
    return buffer;
  }

  static fromPng(width: number, height: number, pngBuffer: Uint8Array): PixelBuffer {
    const buffer = new PixelBuffer(width, height);
    buffer.importPng(pngBuffer, width, height);
    return buffer;
  }

  private ensureDataView(): Uint8ClampedArray {
    if (this.dataView.byteLength === 0) {
      this.refreshDataView();
    }
    return this.dataView;
  }

  private refreshDataView(): void {
    const rawView = this.wasmBuffer.data();
    if (rawView instanceof Uint8ClampedArray) {
      this.dataView = rawView;
    } else {
      this.dataView = new Uint8ClampedArray((rawView as any).buffer, (rawView as any).byteOffset, (rawView as any).length);
    }
  }

  /**
   * Get pixel color at coordinates (bounds-checked)
   */
  get(x: number, y: number): RGBA {
    if (!this.isInBounds(x, y)) {
      return [0, 0, 0, 0]; // transparent black for out-of-bounds
    }

    const idx = (y * this.width + x) * 4;
    const data = this.data;
    return [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]];
  }

  /**
   * Set pixel color at coordinates (bounds-checked)
   * Returns true if pixel was actually changed
   */
  set(x: number, y: number, color: RGBA): boolean {
    if (!this.isInBounds(x, y)) {
      return false;
    }

    const idx = (y * this.width + x) * 4;
    const data = this.data;
    const changed = data[idx] !== color[0] || data[idx + 1] !== color[1] || data[idx + 2] !== color[2] || data[idx + 3] !== color[3];

    if (changed) {
      data[idx] = color[0];
      data[idx + 1] = color[1];
      data[idx + 2] = color[2];
      data[idx + 3] = color[3];
    }

    return changed;
  }

  /**
   * Check if coordinates are within buffer bounds
   */
  isInBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  /**
   * Resize buffer with optional source/destination origins for cropping/pasting
   */
  resize(
    newSize: Size,
    options?: {
      srcOrigin?: Point;
      destOrigin?: Point;
    }
  ): void {
    const srcOrigin = options?.srcOrigin ?? { x: 0, y: 0 };
    const destOrigin = options?.destOrigin ?? { x: 0, y: 0 };

    this.wasmBuffer.resize_instant(newSize.width, newSize.height, srcOrigin.x, srcOrigin.y, destOrigin.x, destOrigin.y);
    this.refreshDataView();
    this.width = newSize.width;
    this.height = newSize.height;
  }

  /**
   * Create a copy of this buffer
   */
  clone(): PixelBuffer {
    return new PixelBuffer(this.width, this.height, new Uint8ClampedArray(this.data));
  }

  /**
   * Fill entire buffer with a single color
   */
  fill(color: RGBA): void {
    const [r, g, b, a] = color;
    const data = this.data;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
  }

  exportWebp(): Uint8Array {
    return this.wasmBuffer.exportWebp();
  }

  exportPng(): Uint8Array {
    return this.wasmBuffer.exportPng();
  }

  importRaw(buffer: Uint8Array | Uint8ClampedArray, width: number, height: number): boolean {
    const view = PixelBuffer.toUint8View(buffer);
    const ok = this.wasmBuffer.importRaw(view, width, height);
    if (ok) {
      this.width = width;
      this.height = height;
      this.refreshDataView();
    }
    return ok;
  }

  importWebp(buffer: Uint8Array, width: number, height: number): boolean {
    const ok = this.wasmBuffer.importWebp(buffer, width, height);
    if (ok) {
      this.width = width;
      this.height = height;
      this.refreshDataView();
    }
    return ok;
  }

  importPng(buffer: Uint8Array, width: number, height: number): boolean {
    const ok = this.wasmBuffer.importPng(buffer, width, height);
    if (ok) {
      this.width = width;
      this.height = height;
      this.refreshDataView();
    }
    return ok;
  }

  floodFill(
    startX: number,
    startY: number,
    color: RGBA,
    options?: {
      threshold?: number;
      mask?: {
        buffer: Uint8Array;
        mode: 'inside' | 'outside' | 'none';
      };
    }
  ): boolean {
    const threshold = options?.threshold ?? 0;
    if (options?.mask && options.mask.mode !== 'none') {
      return this.wasmBuffer.floodFillWithMask(
        startX,
        startY,
        color[0],
        color[1],
        color[2],
        color[3],
        threshold,
        options.mask.buffer,
        options.mask.mode
      );
    }

    return this.wasmBuffer.floodFill(startX, startY, color[0], color[1], color[2], color[3], threshold);
  }

  transferFromRaw(source: Uint8Array | Uint8ClampedArray, width: number, height: number, options?: TransferOptions): void {
    const view = PixelBuffer.toUint8View(source);
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

    this.wasmBuffer.blitFromRaw(view, width, height, offsetX, offsetY, scaleX, scaleY, rotate, antialiasMode, flipX, flipY);
    this.refreshDataView();
  }

  transferFromBuffer(source: PixelBuffer, options?: TransferOptions): void {
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

    this.wasmBuffer.blitFromBuffer(source.wasmBuffer, offsetX, offsetY, scaleX, scaleY, rotate, antialiasMode, flipX, flipY);
    this.refreshDataView();
  }

  sliceWithMask(mask: Uint8Array | Uint8ClampedArray, maskWidth: number, maskHeight: number, options?: MaskOptions): Uint8ClampedArray {
    const maskView = PixelBuffer.toUint8View(mask);
    const data = this.wasmBuffer.sliceWithMask(maskView, maskWidth, maskHeight, options?.offsetX ?? 0, options?.offsetY ?? 0);
    return new Uint8ClampedArray(data.buffer);
  }

  cropWithMask(mask: Uint8Array | Uint8ClampedArray, maskWidth: number, maskHeight: number, options?: MaskOptions): Uint8ClampedArray {
    const maskView = PixelBuffer.toUint8View(mask);
    const data = this.wasmBuffer.cropWithMask(maskView, maskWidth, maskHeight, options?.offsetX ?? 0, options?.offsetY ?? 0);
    return new Uint8ClampedArray(data.buffer);
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
