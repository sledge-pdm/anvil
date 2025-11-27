import { describe, expect, it } from 'vitest';
import type { RGBA } from '../../src/models/RGBA';
import { RgbaBuffer } from '../../src/wasm/pkg/anvil_wasm';

const makeColor = (x: number, y: number): RGBA => [x, y, (x + y) % 256, 255];

const seedBuffer = (w: number, h: number) => {
  const buf = new RgbaBuffer(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      buf.set(x, y, ...makeColor(x, y));
    }
  }
  return buf;
};

describe('RgbaBuffer.resizeWithOrigins', () => {
  it('shifts content left and fills exposed area with transparent when size unchanged', () => {
    const buf = seedBuffer(4, 3);

    // Move source 1px right -> new canvas (same size) shifts everything left by 1
    buf.resizeWithOrigins(4, 3, 1, 0, 0, 0);

    expect(buf.get(0, 0)).toEqual(makeColor(1, 0));
    expect(buf.get(2, 1)).toEqual(makeColor(3, 1));
    expect(buf.get(3, 2)).toEqual([0, 0, 0, 0]); // newly exposed column must be transparent
  });

  it('shifts content down/right on grow and keeps new margin transparent', () => {
    const buf = seedBuffer(4, 3);

    // Grow to 6x4 and place old buffer starting at (1,1)
    buf.resizeWithOrigins(6, 4, 0, 0, 1, 1);

    expect(buf.width()).toBe(6);
    expect(buf.height()).toBe(4);
    expect(buf.get(1, 1)).toEqual(makeColor(0, 0));
    expect(buf.get(4, 2)).toEqual(makeColor(3, 1));

    // Top row and left column (newly added) should be transparent
    expect(buf.get(0, 0)).toEqual([0, 0, 0, 0]);
    expect(buf.get(0, 3)).toEqual([0, 0, 0, 0]);
  });

  it('shifts content up/left with destOrigin and clears trailing area on shrink', () => {
    const buf = seedBuffer(5, 4);

    // Shrink to 4x3 while moving content down-right by 1 (destOrigin=1,1)
    buf.resizeWithOrigins(4, 3, 0, 0, 1, 1);

    // Original (0,0) should end up at (1,1) after shrink and shift
    expect(buf.get(1, 1)).toEqual(makeColor(0, 0));
    // Area outside the copied rectangle (top row / left column) should be transparent
    expect(buf.get(0, 0)).toEqual([0, 0, 0, 0]);
    expect(buf.get(3, 0)).toEqual([0, 0, 0, 0]);
    // Rightmost column within copied area should still contain shifted content
    expect(buf.get(3, 2)).toEqual(makeColor(2, 1));
  });
});
