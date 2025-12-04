import { describe, expect, it } from 'vitest';
import { DiffsController } from '../../../src/buffer/DiffsController';
import { GREEN, RED } from '../../support/colors';

const makeSwapBuffer = (width: number, height: number, fill: number) => {
  const buffer = new Uint8ClampedArray(width * height * 4);
  buffer.fill(fill);
  return buffer;
};

describe('DiffsController', () => {
  const boundBox = { x: 0, y: 0, width: 2, height: 2 };

  it('starts empty and can discard back to empty', () => {
    const diffs = new DiffsController();
    expect(diffs.hasPendingChanges()).toBe(false);

    diffs.addPixel({ x: 1, y: 1, color: RED });
    expect(diffs.hasPendingChanges()).toBe(true);

    diffs.discard();
    expect(diffs.hasPendingChanges()).toBe(false);
  });

  it('accumulates pixel diffs and flush clears state', () => {
    const diffs = new DiffsController();
    diffs.addPixel({ x: 0, y: 5, color: GREEN });
    diffs.addPixel({ x: 3, y: 7, color: RED });

    const patch = diffs.flush();
    expect(patch?.pixels).toHaveLength(2);
    expect(diffs.hasPendingChanges()).toBe(false);
  });

  it('replaces pixel diffs with a partial patch', () => {
    const diffs = new DiffsController();
    diffs.addPixel({ x: 2, y: 2, color: RED });

    const swapBuffer = makeSwapBuffer(boundBox.width, boundBox.height, 128);
    diffs.addPartial({ boundBox, swapBuffer });

    const preview = diffs.previewPatch();
    expect(preview?.partial?.boundBox).toEqual(boundBox);
    expect(preview?.pixels).toBeUndefined();
    expect(preview?.whole).toBeUndefined();
  });

  it('overrides partial diffs with a whole patch', () => {
    const diffs = new DiffsController();
    diffs.addPartial({ boundBox, swapBuffer: makeSwapBuffer(boundBox.width, boundBox.height, 64) });

    const width = 4;
    const height = 4;
    diffs.addWhole({ swapBuffer: makeSwapBuffer(width, height, 200), width, height });

    const preview = diffs.previewPatch();
    expect(preview?.whole).toBeDefined();
    expect(preview?.partial).toBeUndefined();
    expect(preview?.pixels).toBeUndefined();
  });

  it('preview does not clear pending diffs', () => {
    const diffs = new DiffsController();
    diffs.addPixel({ x: 10, y: 10, color: RED });

    const firstPreview = diffs.previewPatch();
    expect(firstPreview?.pixels).toHaveLength(1);
    expect(diffs.hasPendingChanges()).toBe(true);
  });

  it('throws when partial buffer size does not match bound box', () => {
    const diffs = new DiffsController();
    const wrongSizeBuffer = new Uint8ClampedArray(3); // width*height*4 = 16 is expected
    expect(() => diffs.addPartial({ boundBox, swapBuffer: wrongSizeBuffer })).toThrow(/does not match/);
  });
});
