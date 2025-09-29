import { describe, expect, test } from 'vitest';
import { createSolidPattern, getOrCreateShapeMask, patternStamp } from '../src/ops/pattern/Pattern.js';

function makeTarget(w: number, h: number) {
  return new Uint8ClampedArray(w * h * 4);
}

function countColored(buf: Uint8ClampedArray, w: number, h: number) {
  let c = 0;
  for (let i = 0; i < w * h; i++) if (buf[i * 4 + 3] !== 0) c++;
  return c;
}

describe('patternStamp shape:size pixel mask cache', () => {
  test('circle:10 mask reused and stamping works', () => {
    const key = 'circle:10';
    const mask1 = getOrCreateShapeMask('circle', 10, key);
    const mask2 = getOrCreateShapeMask('circle', 10, key);
    expect(mask1).toBe(mask2); // キャッシュ再利用

    const w = 64,
      h = 64;
    const buf = makeTarget(w, h);
    const pattern = createSolidPattern([0, 255, 0, 255]);

    patternStamp({
      target: buf,
      targetWidth: w,
      targetHeight: h,
      centerX: 30,
      centerY: 31,
      pattern,
      maskKey: key,
      shape: 'circle',
      size: 10,
      opacity: 1,
    });

    const colored = countColored(buf, w, h);
    expect(colored).toBeGreaterThan(0);
  });

  test('square:5 stamp uses correct area (approx)', () => {
    const key = 'square:5';
    const w = 32,
      h = 32;
    const buf = makeTarget(w, h);
    const pattern = createSolidPattern([255, 0, 0, 255]);

    patternStamp({
      target: buf,
      targetWidth: w,
      targetHeight: h,
      centerX: 10,
      centerY: 10,
      pattern,
      maskKey: key,
      shape: 'square',
      size: 5,
    });

    // 5x5 = 25 ピクセル (端が画面内なのでそのまま)
    const colored = countColored(buf, w, h);
    expect(colored).toBe(25);
  });
});
