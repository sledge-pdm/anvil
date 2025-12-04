import { describe, expect, it } from 'vitest';
import { pngToRaw, rawToPng, rawToWebp, webpToRaw } from '../../../src/ops/Packing';
import { coordinateColor, coordinateColoredBuffer } from '../../support/colors';

describe('WebP / PNG packing', () => {
  const width = 4;
  const height = 3;

  it('encodes and decodes PNG losslessly', () => {
    const src = coordinateColoredBuffer(width, height).data();

    const png = rawToPng(src, width, height);
    const decoded = pngToRaw(png, width, height);

    expect(Array.from(decoded)).toEqual(Array.from(src));
    expect(decoded.length).toBe(src.length);
    // Spot-check first pixel for clarity
    expect(Array.from(decoded.slice(0, 4))).toEqual(coordinateColor(0, 0));
  });

  it('encodes to WebP and decodes back to expected size', () => {
    const src = coordinateColoredBuffer(width, height).data();

    const webp = rawToWebp(src, width, height);
    const decoded = webpToRaw(webp, width, height);

    expect(webp.byteLength).toBeGreaterThan(0);
    expect(decoded.length).toBe(src.length);
  });
});
