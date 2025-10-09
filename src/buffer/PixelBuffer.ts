import { resizeBuffer } from '../ops/resize/Resize.js';
import type { Point, RGBA, Size } from '../types/types.js';

/**
 * Core pixel buffer operations - raw RGBA8 array management
 * Model responsibility: owns buffer state, provides bounds-checked access
 */
export class PixelBuffer {
  public width: number;
  public height: number;
  public data: Uint8ClampedArray;

  constructor(width: number, height: number, initialData?: Uint8ClampedArray) {
    this.width = width;
    this.height = height;
    this.data = initialData ?? new Uint8ClampedArray(width * height * 4);

    if (this.data.length !== width * height * 4) {
      throw new Error(`Buffer size mismatch: expected ${width * height * 4}, got ${this.data.length}`);
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
    return [this.data[idx], this.data[idx + 1], this.data[idx + 2], this.data[idx + 3]];
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
    const changed =
      this.data[idx] !== color[0] || this.data[idx + 1] !== color[1] || this.data[idx + 2] !== color[2] || this.data[idx + 3] !== color[3];

    if (changed) {
      this.data[idx] = color[0];
      this.data[idx + 1] = color[1];
      this.data[idx + 2] = color[2];
      this.data[idx + 3] = color[3];
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
    const buf = resizeBuffer(
      this.data,
      {
        width: this.width,
        height: this.height,
      },
      newSize,
      options
    );
    this.data = buf;
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
    for (let i = 0; i < this.data.length; i += 4) {
      this.data[i] = r;
      this.data[i + 1] = g;
      this.data[i + 2] = b;
      this.data[i + 3] = a;
    }
  }
}
