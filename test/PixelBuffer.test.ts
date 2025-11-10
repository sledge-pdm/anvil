import { beforeEach, describe, expect, it } from 'vitest';
import { PixelBuffer } from '../src/buffer/PixelBuffer';
import { RGBA } from '../src/types/types';

describe('PixelBuffer', () => {
  let buffer: PixelBuffer;
  const width = 16;
  const height = 16;

  beforeEach(() => {
    buffer = new PixelBuffer(width, height);
  });

  describe('initialization', () => {
    it('should create buffer with correct dimensions', () => {
      expect(buffer.width).toBe(width);
      expect(buffer.height).toBe(height);
      expect(buffer.data.length).toBe(width * height * 4);
    });

    it('should initialize with transparent pixels', () => {
      const pixel = buffer.get(0, 0);
      expect(pixel).toEqual([0, 0, 0, 0]);
    });

    it('should accept initial data', () => {
      const data = new Uint8ClampedArray(width * height * 4);
      data.fill(255); // Fill with white
      const bufferWithData = new PixelBuffer(width, height, data);

      const pixel = bufferWithData.get(0, 0);
      expect(pixel).toEqual([255, 255, 255, 255]);
    });
  });

  describe('pixel operations', () => {
    it('should set and get pixels correctly', () => {
      const color: RGBA = [255, 128, 64, 200];
      buffer.set(5, 7, color);

      const retrieved = buffer.get(5, 7);
      expect(retrieved).toEqual(color);
    });

    it('should handle edge coordinates', () => {
      const color: RGBA = [100, 150, 200, 255];

      // Top-left corner
      buffer.set(0, 0, color);
      expect(buffer.get(0, 0)).toEqual(color);

      // Bottom-right corner
      buffer.set(width - 1, height - 1, color);
      expect(buffer.get(width - 1, height - 1)).toEqual(color);
    });

    it('should handle out-of-bounds gracefully', () => {
      // Should not throw errors
      expect(() => buffer.set(-1, 0, [255, 0, 0, 255])).not.toThrow();
      expect(() => buffer.set(width, 0, [255, 0, 0, 255])).not.toThrow();
      expect(() => buffer.set(0, height, [255, 0, 0, 255])).not.toThrow();

      // Should return [0, 0, 0, 0] for out-of-bounds
      expect(buffer.get(-1, 0)).toEqual([0, 0, 0, 0]);
      expect(buffer.get(width, 0)).toEqual([0, 0, 0, 0]);
      expect(buffer.get(0, height)).toEqual([0, 0, 0, 0]);
    });

    it('should return true when pixel changes', () => {
      const color: RGBA = [255, 0, 0, 255];
      const result = buffer.set(5, 5, color);
      expect(result).toBe(true);
    });

    it('should return false when pixel does not change', () => {
      const color: RGBA = [0, 0, 0, 0]; // Default transparent
      const result = buffer.set(5, 5, color);
      expect(result).toBe(false);
    });
  });

  describe('resize operations', () => {
    beforeEach(() => {
      // Set some test data
      buffer.set(2, 3, [255, 0, 0, 255]); // Red
      buffer.set(8, 8, [0, 255, 0, 255]); // Green
    });

    it('should resize buffer larger', () => {
      buffer.resize({ width: 32, height: 24 });

      expect(buffer.width).toBe(32);
      expect(buffer.height).toBe(24);
      expect(buffer.data.length).toBe(32 * 24 * 4);

      // Original data should be preserved
      expect(buffer.get(2, 3)).toEqual([255, 0, 0, 255]);
      expect(buffer.get(8, 8)).toEqual([0, 255, 0, 255]);
    });

    it('should resize buffer smaller', () => {
      buffer.resize({ width: 8, height: 8 });

      expect(buffer.width).toBe(8);
      expect(buffer.height).toBe(8);

      // Data within new bounds should be preserved
      expect(buffer.get(2, 3)).toEqual([255, 0, 0, 255]);

      // Data outside new bounds should be inaccessible
      expect(buffer.get(8, 8)).toEqual([0, 0, 0, 0]);
    });

    it('should resize with origin offset', () => {
      buffer.resize({ width: 24, height: 24 }, { destOrigin: { x: 4, y: 4 } });

      expect(buffer.width).toBe(24);
      expect(buffer.height).toBe(24);

      // Original pixel at (2, 3) should now be at (2+4, 3+4) = (6, 7)
      expect(buffer.get(6, 7)).toEqual([255, 0, 0, 255]);
      expect(buffer.get(12, 12)).toEqual([0, 255, 0, 255]);
    });
  });

  describe('utility methods', () => {
    it('should check bounds correctly', () => {
      expect(buffer.isInBounds(0, 0)).toBe(true);
      expect(buffer.isInBounds(width - 1, height - 1)).toBe(true);
      expect(buffer.isInBounds(-1, 0)).toBe(false);
      expect(buffer.isInBounds(width, 0)).toBe(false);
      expect(buffer.isInBounds(0, height)).toBe(false);
    });

    it('should clone buffer correctly', () => {
      buffer.set(5, 5, [255, 128, 64, 200]);
      buffer.set(10, 10, [64, 128, 255, 150]);

      const cloned = buffer.clone();

      expect(cloned.width).toBe(buffer.width);
      expect(cloned.height).toBe(buffer.height);
      expect(cloned.get(5, 5)).toEqual([255, 128, 64, 200]);
      expect(cloned.get(10, 10)).toEqual([64, 128, 255, 150]);

      // Verify it's a separate instance
      cloned.set(5, 5, [100, 100, 100, 100]);
      expect(buffer.get(5, 5)).toEqual([255, 128, 64, 200]); // Original unchanged
    });

    it('should fill buffer with color', () => {
      const fillColor: RGBA = [128, 64, 192, 255];
      buffer.fill(fillColor);

      // Check multiple positions
      expect(buffer.get(0, 0)).toEqual(fillColor);
      expect(buffer.get(5, 5)).toEqual(fillColor);
      expect(buffer.get(width - 1, height - 1)).toEqual(fillColor);
    });
  });

  describe('compositing and mask operations', () => {
    it('should transfer raw buffer with offset', () => {
      const source = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]);
      buffer.transferFromRaw(source, 2, 2, { offsetX: 1, offsetY: 1 });

      expect(buffer.get(1, 1)).toEqual([255, 0, 0, 255]);
      expect(buffer.get(2, 1)).toEqual([0, 255, 0, 255]);
      expect(buffer.get(1, 2)).toEqual([0, 0, 255, 255]);
      expect(buffer.get(2, 2)).toEqual([255, 255, 255, 255]);
    });

    it('should flip source horizontally when requested', () => {
      const source = new Uint8ClampedArray([
        255,
        0,
        0,
        255, // red
        0,
        255,
        0,
        255, // green
        0,
        0,
        255,
        255, // blue
        255,
        255,
        255,
        255, // white
      ]);
      buffer.transferFromRaw(source, 2, 2, { offsetX: 0, offsetY: 0, flipX: true });

      expect(buffer.get(0, 0)).toEqual([0, 255, 0, 255]);
      expect(buffer.get(1, 0)).toEqual([255, 0, 0, 255]);
      expect(buffer.get(0, 1)).toEqual([255, 255, 255, 255]);
      expect(buffer.get(1, 1)).toEqual([0, 0, 255, 255]);
    });

    it('should flip source vertically when requested', () => {
      const source = new Uint8ClampedArray([
        255,
        0,
        0,
        255, // red
        0,
        255,
        0,
        255, // green
        0,
        0,
        255,
        255, // blue
        255,
        255,
        255,
        255, // white
      ]);
      buffer.transferFromRaw(source, 2, 2, { offsetX: 0, offsetY: 0, flipY: true });

      expect(buffer.get(0, 0)).toEqual([0, 0, 255, 255]);
      expect(buffer.get(1, 0)).toEqual([255, 255, 255, 255]);
      expect(buffer.get(0, 1)).toEqual([255, 0, 0, 255]);
      expect(buffer.get(1, 1)).toEqual([0, 255, 0, 255]);
    });

    it('should slice buffer using mask', () => {
      buffer.set(0, 0, [10, 20, 30, 255]);
      buffer.set(1, 0, [40, 50, 60, 255]);
      buffer.set(0, 1, [70, 80, 90, 255]);
      buffer.set(1, 1, [100, 110, 120, 255]);
      const mask = new Uint8Array([1, 0, 0, 1]);

      const sliced = buffer.sliceWithMask(mask, 2, 2, { offsetX: 0, offsetY: 0 });
      expect(Array.from(sliced)).toEqual([10, 20, 30, 255, 0, 0, 0, 0, 0, 0, 0, 0, 100, 110, 120, 255]);
    });

    it('should crop buffer using mask', () => {
      buffer.set(0, 0, [10, 20, 30, 255]);
      buffer.set(1, 0, [40, 50, 60, 255]);
      buffer.set(0, 1, [70, 80, 90, 255]);
      buffer.set(1, 1, [100, 110, 120, 255]);
      const mask = new Uint8Array([1, 0, 0, 0]);

      const cropped = buffer.cropWithMask(mask, 2, 2, { offsetX: 0, offsetY: 0 });
      const view = new Uint8ClampedArray(cropped);
      const readPixel = (x: number, y: number) => {
        const idx = (y * width + x) * 4;
        return Array.from(view.slice(idx, idx + 4));
      };

      expect(readPixel(0, 0)).toEqual([0, 0, 0, 0]);
      expect(readPixel(1, 0)).toEqual([40, 50, 60, 255]);
      expect(readPixel(0, 1)).toEqual([70, 80, 90, 255]);
      expect(readPixel(1, 1)).toEqual([100, 110, 120, 255]);
    });
  });
});
