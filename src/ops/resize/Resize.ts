import { resize } from '../../ops_wasm/pkg/anvil_ops_wasm';
import { Point, Size } from '../../types';

export function resizeBuffer(
  buffer: Uint8ClampedArray,
  oldSize: Size,
  newSize: Size,
  options?: {
    srcOrigin?: Point;
    destOrigin?: Point;
  }
): Uint8ClampedArray {
  const { width: oldW, height: oldH } = oldSize;
  const { width: newW, height: newH } = newSize;
  const srcOrigin = options?.srcOrigin ?? { x: 0, y: 0 };
  const destOrigin = options?.destOrigin ?? { x: 0, y: 0 };
  const buf = resize(
    new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.length),
    oldW,
    oldH,
    newW,
    newH,
    srcOrigin.x,
    srcOrigin.y,
    destOrigin.x,
    destOrigin.y
  );

  return new Uint8ClampedArray(buf.buffer);
}
