import { Anvil } from '../../Anvil.js';
import type { RGBA } from '../../types.js';

export interface ShapeMask {
  mask: Uint8Array; // 0 or 1
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

interface PutShapeOptions {
  anvil: Anvil;
  shape: ShapeMask;
  posX: number; // centerX
  posY: number; // centerY
  color: RGBA;
  filter?: (x: number, y: number) => boolean; // true の時描画許可
  manualDiff?: boolean; // true なら変更前後を返却
}

export function putShape(opts: PutShapeOptions) {
  const { shape, anvil, posX, posY, color, filter, manualDiff } = opts;
  if (!shape || shape.width <= 0 || shape.height <= 0) return undefined;

  const { mask, width: mW, height: mH, offsetX, offsetY } = shape;
  const targetWidth = anvil.getWidth();
  const targetHeight = anvil.getHeight();
  const tlX = posX + offsetX;
  const tlY = posY + offsetY;
  const target = anvil.getBufferData();

  const diffs: Array<{ x: number; y: number; before: RGBA; after: RGBA }> = manualDiff ? [] : (undefined as any);
  
  for (let iy = 0; iy < mH; iy++) {
    const ty = tlY + iy;
    if (ty < 0 || ty >= targetHeight) continue;
    const rowOff = iy * mW;
    for (let ix = 0; ix < mW; ix++) {
      if (mask[rowOff + ix] !== 1) continue;
      const tx = tlX + ix;
      if (tx < 0 || tx >= targetWidth) continue;
      if (filter && !filter(tx, ty)) continue;

      if (manualDiff) {
        const before = anvil.getPixel(tx, ty) as RGBA;
        // anvil.setPixel(tx, ty, color); DON'T DO THIS BECAUSE IT ADDS DIFF AUTOMATICALLY
        const ti = (tx + ty * targetWidth) * 4;
        target[ti] = color[0];
        target[ti + 1] = color[1];
        target[ti + 2] = color[2];
        target[ti + 3] = color[3];
        diffs!.push({ x: tx, y: ty, before, after: color });
      } else {
        anvil.setPixel(tx, ty, color);
      }
    }
  }

  return diffs;
}

interface PutShapeLineOptions extends PutShapeOptions {
  fromPosX: number;
  fromPosY: number;
}

export function putShapeLine(opts: PutShapeLineOptions) {
  const { fromPosX, fromPosY, posX, posY, manualDiff } = opts;

  // 単一点なら putShape で終わり
  if (fromPosX === posX && fromPosY === posY) {
    return putShape(opts);
  }

  // Bresenham (整数座標)
  let x0 = fromPosX | 0;
  let y0 = fromPosY | 0;
  const x1 = posX | 0;
  const y1 = posY | 0;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  // diff 収集 (重複座標の before は最初のものを保持)
  let aggregated: Array<{ x: number; y: number; before: RGBA; after: RGBA }> | undefined;
  const diffMap: Map<string, { x: number; y: number; before: RGBA; after: RGBA }> = manualDiff ? new Map() : new Map();

  while (true) {
    // 1 スタンプ (中心を現在点に)
    if (manualDiff) {
      const diffs = putShape({ ...opts, posX: x0, posY: y0, manualDiff: true }) as
        | Array<{
            x: number;
            y: number;
            before: RGBA;
            after: RGBA;
          }>
        | undefined;
      if (diffs) {
        for (const d of diffs) {
          const key = d.x + ',' + d.y;
          if (!diffMap.has(key)) diffMap.set(key, d);
        }
      }
    } else {
      putShape({ ...opts, posX: x0, posY: y0, manualDiff: false });
    }

    if (x0 === x1 && y0 === y1) break;
    const e2 = err * 2;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }

  if (manualDiff) {
    aggregated = Array.from(diffMap.values());
    return aggregated;
  }
  return undefined;
}
