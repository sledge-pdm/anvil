import { describe, expect, test } from 'vitest';
import { Anvil } from '../src/Anvil.js';
import { putShapeLine, type ShapeMask } from '../src/ops/pattern/Shape.js';

function makeDotMask(): ShapeMask {
  return { mask: new Uint8Array([1]), width: 1, height: 1, offsetX: 0, offsetY: 0 };
}

describe('putShapeLine', () => {
  test('draws a horizontal line of dots', () => {
    const anvil = new Anvil(20, 10, 8);
    const mask = makeDotMask();
    putShapeLine({ anvil, shape: mask, fromPosX: 2, fromPosY: 5, posX: 10, posY: 5, color: [255, 0, 0, 255] });
    let count = 0;
    for (let x = 2; x <= 10; x++) {
      const p = anvil.getPixel(x, 5);
      if (p[3] !== 0) count++;
    }
    expect(count).toBe(10 - 2 + 1);
  });

  test('collectDiff aggregates unique pixels over line', () => {
    const anvil = new Anvil(30, 30, 8);
    const mask = makeDotMask();
    const diffs = putShapeLine({ anvil, shape: mask, fromPosX: 0, fromPosY: 0, posX: 15, posY: 15, color: [0, 255, 0, 255], manualDiff: true });
    expect(diffs).toBeDefined();
    // 対角線の長さ (Bresenham は 16 ピクセルになる想定: 0..15)
    expect(diffs!.length).toBeGreaterThanOrEqual(15);
    expect(diffs!.length).toBeLessThanOrEqual(17);
  });
});
