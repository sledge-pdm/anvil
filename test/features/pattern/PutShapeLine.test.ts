import { describe, expect, test } from 'vitest';
import { Anvil } from '../../../src/Anvil.js';
import { putShapeLine } from '../../../src/ops/Shape.js';
import { GREEN, RED } from '../../support/colors';
import { makeOneDotMask } from '../../support/shapes.js';

describe('putShapeLine', () => {
  test('draws a horizontal line of dots', () => {
    const anvil = new Anvil(20, 10, 8);
    const mask = makeOneDotMask();
    putShapeLine({ anvil, shape: mask, fromPosX: 2, fromPosY: 5, posX: 10, posY: 5, color: RED });
    let count = 0;
    for (let x = 2; x <= 10; x++) {
      const p = anvil.getPixel(x, 5);
      if (p[3] !== 0) count++;
    }
    expect(count).toBe(10 - 2 + 1);
  });

  test('collectDiff aggregates unique pixels over line', () => {
    const anvil = new Anvil(30, 30, 8);
    const mask = makeOneDotMask();
    const diffs = putShapeLine({ anvil, shape: mask, fromPosX: 0, fromPosY: 0, posX: 15, posY: 15, color: GREEN, manualDiff: true });
    expect(diffs).toBeDefined();
    // 対角線の長さ (Bresenham は 16 ピクセルになる想定: 0..15)
    expect(diffs!.length).toBeGreaterThanOrEqual(15);
    expect(diffs!.length).toBeLessThanOrEqual(17);
  });
});
