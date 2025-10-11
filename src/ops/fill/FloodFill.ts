// FloodFill。
// 基本的にsledgeや他のユースケースから手法や最適化に関する情報は見えないようにしたい。
// 現状のWASM / scanline fillで十分速いので、floodfill関数は黙ってそれを採用する。

import { scanline_flood_fill, scanline_flood_fill_with_mask } from '../../ops_wasm/pkg/anvil_ops_wasm.js';

export function floodFill(args: {
  target: Uint8ClampedArray;
  targetWidth: number;
  targetHeight: number;
  startX: number;
  startY: number;
  fillColor: [number, number, number, number];
  threshold?: number;
  mask?: {
    buffer: Uint8Array; // layer size
    mode: 'inside' | 'outside' | 'none';
  };
}): boolean {
  const { target, targetWidth, targetHeight, startX, startY, fillColor, threshold, mask } = args;

  if (mask) {
    const { buffer, mode } = mask;
    const result = scanline_flood_fill_with_mask(
      new Uint8Array(target.buffer, target.byteOffset, target.byteLength),
      targetWidth,
      targetHeight,
      startX,
      startY,
      fillColor[0],
      fillColor[1],
      fillColor[2],
      fillColor[3],
      threshold ?? 0,
      buffer,
      mode
    );

    return result;
  } else {
    // does breaking change
    const result = scanline_flood_fill(
      new Uint8Array(target.buffer, target.byteOffset, target.byteLength),
      targetWidth,
      targetHeight,
      startX,
      startY,
      fillColor[0],
      fillColor[1],
      fillColor[2],
      fillColor[3],
      threshold ?? 0
    );

    return result;
  }
}
