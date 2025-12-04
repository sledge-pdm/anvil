import { ShapeMask } from '../../src/ops/Shape';

export function makeSquareMask(size: number): ShapeMask {
  const half = Math.floor(size / 2);
  const w = size;
  const h = size;
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) mask[y * w + x] = 1;
  }
  return { mask, width: w, height: h, offsetX: -half, offsetY: -half };
}

export function makeOneDotMask(): ShapeMask {
  return { mask: new Uint8Array([1]), width: 1, height: 1, offsetX: 0, offsetY: 0 };
}
