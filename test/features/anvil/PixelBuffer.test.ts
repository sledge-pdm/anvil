import { beforeEach, describe, expect, it } from 'vitest';
import type { RGBA } from '../../../src/models/RGBA';
import { RgbaBuffer } from '../../../src/wasm/pkg/anvil_wasm';
import { BLUE, GREEN, RED, TRANSPARENT, WHITE } from '../../support/colors';

describe('RgbaBuffer', () => {
  let buffer: RgbaBuffer;
  const BUFFER_WIDTH = 16;
  const BUFFER_HEIGHT = 16;

  beforeEach(() => {
    buffer = new RgbaBuffer(BUFFER_WIDTH, BUFFER_HEIGHT);
  });

  describe('initialization', () => {
    it('should create buffer with correct dimensions', () => {
      expect(buffer.width()).toBe(BUFFER_WIDTH);
      expect(buffer.height()).toBe(BUFFER_HEIGHT);
      expect(buffer.data().length).toBe(BUFFER_WIDTH * BUFFER_HEIGHT * 4);
    });

    it('should initialize with transparent pixels', () => {
      expect(buffer.get(0, 0)).toEqual(TRANSPARENT);
    });

    it('should accept initial data', () => {
      const data = new Uint8Array(BUFFER_WIDTH * BUFFER_HEIGHT * 4);
      data.fill(255); // Fill with white
      const bufferWithData = RgbaBuffer.fromRaw(BUFFER_WIDTH, BUFFER_HEIGHT, data);

      const pixel = bufferWithData.get(0, 0);
      expect([pixel[0], pixel[1], pixel[2], pixel[3]]).toEqual(WHITE);
    });
  });

  describe('pixel operations', () => {
    it('should set and get pixels correctly', () => {
      const color: RGBA = [255, 128, 64, 200];
      buffer.set(5, 7, ...color);

      expect(buffer.get(5, 7)).toEqual(color);
    });

    it('should handle edge coordinates', () => {
      const color: RGBA = [100, 150, 200, 255];

      // Top-left corner
      buffer.set(0, 0, ...color);
      expect(buffer.get(0, 0)).toEqual(color);

      // Bottom-right corner
      buffer.set(BUFFER_WIDTH - 1, BUFFER_HEIGHT - 1, ...color);
      expect(buffer.get(BUFFER_WIDTH - 1, BUFFER_HEIGHT - 1)).toEqual(color);
    });

    it('should handle out-of-bounds gracefully', () => {
      // Should not throw errors
      expect(() => buffer.set(-1, 0, ...RED)).not.toThrow();
      expect(() => buffer.set(BUFFER_WIDTH, 0, ...RED)).not.toThrow();
      expect(() => buffer.set(0, BUFFER_HEIGHT, ...RED)).not.toThrow();

      // Should return transparent for out-of-bounds
      expect(buffer.get(-1, 0)).toEqual(TRANSPARENT);
      expect(buffer.get(BUFFER_WIDTH, 0)).toEqual(TRANSPARENT);
      expect(buffer.get(0, BUFFER_HEIGHT)).toEqual(TRANSPARENT);
    });

    it('should return true when pixel changes', () => {
      const color: RGBA = RED;
      const result = buffer.set(5, 5, ...color);
      expect(result).toBe(true);
    });

    it('should return false when pixel does not change', () => {
      const color: RGBA = TRANSPARENT; // Default transparent
      const result = buffer.set(5, 5, ...color);
      expect(result).toBe(false);
    });
  });

  describe('resize operations', () => {
    beforeEach(() => {
      // Set some test data
      buffer.set(2, 3, ...RED); // Red
      buffer.set(8, 8, ...GREEN); // Green
    });

    it('should resize buffer larger', () => {
      buffer.resize(32, 24);

      expect(buffer.width()).toBe(32);
      expect(buffer.height()).toBe(24);
      expect(buffer.data().length).toBe(32 * 24 * 4);

      // Original data should be preserved
      expect(buffer.get(2, 3)).toEqual(RED);
      expect(buffer.get(8, 8)).toEqual(GREEN);
    });

    it('should resize buffer smaller', () => {
      buffer.resize(8, 8);

      expect(buffer.width()).toBe(8);
      expect(buffer.height()).toBe(8);

      // Data within new bounds should be preserved
      expect(buffer.get(2, 3)).toEqual(RED);

      // Data outside new bounds should be inaccessible
      expect(buffer.get(8, 8)).toEqual(TRANSPARENT);
    });

    it('should resize with origin offset', () => {
      buffer.resizeWithOrigins(24, 24, 0, 0, 4, 4);

      expect(buffer.width()).toBe(24);
      expect(buffer.height()).toBe(24);

      // Original pixel at (2, 3) should now be at (2+4, 3+4) = (6, 7)
      expect(buffer.get(6, 7)).toEqual(RED);
      expect(buffer.get(12, 12)).toEqual(GREEN);
    });
  });

  describe('utility methods', () => {
    it('should check bounds correctly', () => {
      expect(buffer.isInBounds(0, 0)).toBe(true);
      expect(buffer.isInBounds(BUFFER_WIDTH - 1, BUFFER_HEIGHT - 1)).toBe(true);
      expect(buffer.isInBounds(-1, 0)).toBe(false);
      expect(buffer.isInBounds(BUFFER_WIDTH, 0)).toBe(false);
      expect(buffer.isInBounds(0, BUFFER_HEIGHT)).toBe(false);
    });

    it('should clone buffer correctly', () => {
      buffer.set(5, 5, ...[255, 128, 64, 200]);
      buffer.set(10, 10, ...[64, 128, 255, 150]);

      const cloned = buffer.clone();

      expect(cloned.width).toBe(buffer.width);
      expect(cloned.height).toBe(buffer.height);
      expect(cloned.get(5, 5)).toEqual([255, 128, 64, 200]);
      expect(cloned.get(10, 10)).toEqual([64, 128, 255, 150]);

      // Verify it's a separate instance
      cloned.set(5, 5, ...[100, 100, 100, 100]);
      expect(buffer.get(5, 5)).toEqual([255, 128, 64, 200]); // Original unchanged
    });

    it('should fill buffer with color', () => {
      const fillColor: RGBA = [128, 64, 192, 255];
      buffer.fillAllPixels(...fillColor);

      // Check multiple positions
      expect(buffer.get(0, 0)).toEqual(fillColor);
      expect(buffer.get(5, 5)).toEqual(fillColor);
      expect(buffer.get(BUFFER_WIDTH - 1, BUFFER_HEIGHT - 1)).toEqual(fillColor);
    });
  });

  describe('compositing and mask operations', () => {
    it('should transfer raw buffer with offset', () => {
      const source = new Uint8Array([...RED, ...GREEN, ...BLUE, ...WHITE]);
      buffer.blitFromRaw(source, 2, 2, 1, 1, 1, 1, 0, 0, false, false);

      expect(buffer.get(1, 1)).toEqual(RED);
      expect(buffer.get(2, 1)).toEqual(GREEN);
      expect(buffer.get(1, 2)).toEqual(BLUE);
      expect(buffer.get(2, 2)).toEqual(WHITE);
    });

    it('should flip source horizontally when requested', () => {
      const source = new Uint8Array([...RED, ...GREEN, ...BLUE, ...WHITE]);
      buffer.blitFromRaw(source, 2, 2, 0, 0, 1, 1, 0, 0, true, false);

      expect(buffer.get(0, 0)).toEqual(GREEN);
      expect(buffer.get(1, 0)).toEqual(RED);
      expect(buffer.get(0, 1)).toEqual(WHITE);
      expect(buffer.get(1, 1)).toEqual(BLUE);
    });

    it('should flip source vertically when requested', () => {
      const source = new Uint8Array([...RED, ...GREEN, ...BLUE, ...WHITE]);
      buffer.blitFromRaw(source, 2, 2, 0, 0, 1, 1, 0, 0, false, true);

      expect(buffer.get(0, 0)).toEqual(BLUE);
      expect(buffer.get(1, 0)).toEqual(WHITE);
      expect(buffer.get(0, 1)).toEqual(RED);
      expect(buffer.get(1, 1)).toEqual(GREEN);
    });

    it('should slice buffer using mask', () => {
      buffer.set(0, 0, ...[10, 20, 30, 255]);
      buffer.set(1, 0, ...[40, 50, 60, 255]);
      buffer.set(0, 1, ...[70, 80, 90, 255]);
      buffer.set(1, 1, ...[100, 110, 120, 255]);
      const mask = new Uint8Array([1, 0, 0, 1]);

      const sliced = buffer.sliceWithMask(mask, 2, 2, 0, 0);
      expect(Array.from(sliced)).toEqual([10, 20, 30, 255, 0, 0, 0, 0, 0, 0, 0, 0, 100, 110, 120, 255]);
    });

    it('should crop buffer using mask', () => {
      buffer.set(0, 0, ...[10, 20, 30, 255]);
      buffer.set(1, 0, ...[40, 50, 60, 255]);
      buffer.set(0, 1, ...[70, 80, 90, 255]);
      buffer.set(1, 1, ...[100, 110, 120, 255]);
      const mask = new Uint8Array([1, 0, 0, 0]);

      const cropped = buffer.cropWithMask(mask, 2, 2, 0, 0);
      const view = new Uint8ClampedArray(cropped);
      const readPixel = (x: number, y: number) => {
        const idx = (y * BUFFER_WIDTH + x) * 4;
        return Array.from(view.slice(idx, idx + 4));
      };

      expect(readPixel(0, 0)).toEqual(TRANSPARENT);
      expect(readPixel(1, 0)).toEqual([40, 50, 60, 255]);
      expect(readPixel(0, 1)).toEqual([70, 80, 90, 255]);
      expect(readPixel(1, 1)).toEqual([100, 110, 120, 255]);
    });
  });
});
