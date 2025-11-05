import { describe, expect, test } from 'vitest';
import { Anvil } from '../src/Anvil.js';
import { putShape, type ShapeMask } from '../src/ops/pattern/Shape.js';

function makeSquareMask(size: number): ShapeMask {
  const half = Math.floor(size / 2);
  const w = size;
  const h = size;
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) mask[y * w + x] = 1;
  }
  return { mask, width: w, height: h, offsetX: -half, offsetY: -half };
}

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

describe('putShape', () => {
  test('applies square mask at center', () => {
    const anvil = new Anvil(32, 32, 8);
    const shape = makeSquareMask(5); // covers 5x5
    putShape({ anvil, shape, posX: 16, posY: 16, color: [255, 0, 0, 255] });
    let colored = 0;
    for (let y = 14; y <= 18; y++) {
      for (let x = 14; x <= 18; x++) {
        const p = anvil.getPixel(x, y);
        if (p[3] !== 0) {
          colored++;
          expect(p[0]).toBe(255);
        }
      }
    }
    expect(colored).toBe(25);
  });

  test('collectDiff returns changed pixels once', () => {
    const anvil = new Anvil(20, 20, 8);
    const shape = makeSquareMask(3);
    const diffs = putShape({ anvil, shape, posX: 10, posY: 10, color: [0, 255, 0, 200], manualDiff: true });
    expect(diffs).toBeDefined();
    expect(diffs!.length).toBe(9);
    // 再適用 (同色) で diff 数が同じ or 0 になるか (仕様: 再度 collect で before が同色でも取得)
    const diffs2 = putShape({ anvil, shape, posX: 10, posY: 10, color: [0, 255, 0, 200], manualDiff: true });
    expect(diffs2!.length).toBe(9);
  });
});
