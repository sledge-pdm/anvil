import { describe, expect, test } from 'vitest';
import { Anvil } from '../../../src/Anvil.js';
import { putShape } from '../../../src/ops/Shape.js';
import { RED } from '../../support/colors';
import { makeSquareMask } from '../../support/shapes.js';

describe('putShape', () => {
  test('applies square mask at center', () => {
    const anvil = new Anvil(32, 32, 8);
    const shape = makeSquareMask(5); // covers 5x5
    putShape({ anvil, shape, posX: 16, posY: 16, color: RED });
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
