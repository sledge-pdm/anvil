import { describe, expect, test } from 'vitest';
import { createSolidPattern, patternStamp } from '../src/ops/pattern/Pattern.js';

function createBlank(width: number, height: number, color: [number, number, number, number] = [0, 0, 0, 0]) {
  const arr = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    arr[o] = color[0];
    arr[o + 1] = color[1];
    arr[o + 2] = color[2];
    arr[o + 3] = color[3];
  }
  return arr;
}

describe('patternStamp', () => {
  test('stamps solid 1x1 pattern with radius', () => {
    const w = 16,
      h = 16;
    const buf = createBlank(w, h);
    const pattern = createSolidPattern([255, 0, 0, 255]);

    patternStamp({
      target: buf,
      targetWidth: w,
      targetHeight: h,
      centerX: 8,
      centerY: 8,
      pattern,
      radius: 2,
    });

    // 半径2 -> 直径5 の円マスク (単純実装なので点数を概算チェック)
    let colored = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (buf[i + 3] !== 0) {
          colored++;
          expect(buf[i]).toBe(255);
          expect(buf[i + 1]).toBe(0);
          expect(buf[i + 2]).toBe(0);
        }
      }
    }
    // 半径2 の理論的な面積 ~ pi*r^2 = 12.56 -> マスクは格子なので 13-21 程度
    expect(colored).toBeGreaterThanOrEqual(12);
    expect(colored).toBeLessThanOrEqual(21);
  });

  test('erase blend reduces alpha', () => {
    const w = 8,
      h = 8;
    const buf = createBlank(w, h, [10, 20, 30, 255]);
    const pattern = createSolidPattern([0, 0, 0, 255]);

    patternStamp({
      target: buf,
      targetWidth: w,
      targetHeight: h,
      centerX: 4,
      centerY: 4,
      pattern,
      radius: 1,
      blendMode: 'erase',
      opacity: 1,
    });

    // 中心付近の alpha が減衰したか (完全 0 にはならない)
    let changed = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (buf[i + 3] < 255) {
          changed++;
          // 色チャンネルは保持
          expect(buf[i]).toBe(10);
          expect(buf[i + 1]).toBe(20);
          expect(buf[i + 2]).toBe(30);
        }
      }
    }
    expect(changed).toBeGreaterThan(0);
  });
});
