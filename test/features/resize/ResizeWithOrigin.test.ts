import { describe, expect, it } from 'vitest';
import { coordinateColor, coordinateColoredBuffer } from '../../support/colors';

describe('RgbaBuffer.resizeWithOrigins', () => {
  it('shifts content left and fills exposed area with transparent when size unchanged', () => {
    const buf = coordinateColoredBuffer(4, 3);

    // Move source 1px right -> new canvas (same size) shifts everything left by 1
    buf.resizeWithOrigins(4, 3, 1, 0, 0, 0);

    expect(buf.get(0, 0)).toEqual(coordinateColor(1, 0));
    expect(buf.get(2, 1)).toEqual(coordinateColor(3, 1));
    expect(buf.get(3, 2)).toEqual([0, 0, 0, 0]); // newly exposed column must be transparent
  });

  it('shifts content down/right on grow and keeps new margin transparent', () => {
    const buf = coordinateColoredBuffer(4, 3);

    // Grow to 6x4 and place old buffer starting at (1,1)
    buf.resizeWithOrigins(6, 4, 0, 0, 1, 1);

    expect(buf.width()).toBe(6);
    expect(buf.height()).toBe(4);
    expect(buf.get(1, 1)).toEqual(coordinateColor(0, 0));
    expect(buf.get(4, 2)).toEqual(coordinateColor(3, 1));

    // Top row and left column (newly added) should be transparent
    expect(buf.get(0, 0)).toEqual([0, 0, 0, 0]);
    expect(buf.get(0, 3)).toEqual([0, 0, 0, 0]);
  });

  it('shifts content up/left with destOrigin and clears trailing area on shrink', () => {
    const buf = coordinateColoredBuffer(5, 4);

    // Shrink to 4x3 while moving content down-right by 1 (destOrigin=1,1)
    buf.resizeWithOrigins(4, 3, 0, 0, 1, 1);

    // Original (0,0) should end up at (1,1) after shrink and shift
    expect(buf.get(1, 1)).toEqual(coordinateColor(0, 0));
    // Area outside the copied rectangle (top row / left column) should be transparent
    expect(buf.get(0, 0)).toEqual([0, 0, 0, 0]);
    expect(buf.get(3, 0)).toEqual([0, 0, 0, 0]);
    // Rightmost column within copied area should still contain shifted content
    expect(buf.get(3, 2)).toEqual(coordinateColor(2, 1));
  });
});
