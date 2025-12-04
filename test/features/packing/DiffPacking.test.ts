import { describe, expect, it } from 'vitest';
import { packPartial, packPending, packPixels, packWhole } from '../../../src/ops/Packing';
import { coordinateColor, coordinateColoredBuffer } from '../../support/colors';

describe('Diff packing', () => {
  it('packs pixels into u32 colors', () => {
    const packed = packPixels([
      { x: 0, y: 0, color: coordinateColor(0, 0) },
      { x: 1, y: 1, color: coordinateColor(1, 1) },
    ]);

    expect(packed).toEqual([
      { x: 0, y: 0, color: (255 << 24) | (0 << 16) | (0 << 8) | 0 },
      { x: 1, y: 1, color: (255 << 24) | (1 << 16) | (1 << 8) | 2 },
    ]);
  });

  it('packs pending pixels and partial diffs together', () => {
    const boundBox = { x: 0, y: 0, width: 2, height: 2 };
    const src = coordinateColoredBuffer(boundBox.width, boundBox.height);
    const partial = packPartial({ boundBox, swapBuffer: src.data() });

    const packed = packPending({
      pixels: [{ x: 3, y: 4, color: coordinateColor(3, 4) }],
      partial,
      whole: undefined,
    });

    expect(packed.partial?.boundBox).toEqual(boundBox);
    expect(packed.pixels?.[0]?.color).toBe((255 << 24) | (3 << 16) | (4 << 8) | 7);
    expect(packed.whole).toBeUndefined();
  });

  it('packs whole patch and preserves dimensions', () => {
    const width = 4;
    const height = 3;
    const src = coordinateColoredBuffer(width, height);

    const whole = packWhole({ swapBuffer: src.data(), width, height });
    expect(whole.width).toBe(width);
    expect(whole.height).toBe(height);
    expect(whole.swapBufferWebp.byteLength).toBeGreaterThan(0);
  });
});
