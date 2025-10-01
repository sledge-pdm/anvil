import { Anvil } from '../../Anvil.js';
import type { RGBA } from '../../types.js';

/**
 * ShapeMask: 既存のビットマスク表現に加えて、行スパン(run)の高速化キャッシュを追加。
 * rows: y(row オフセット) ごとに 1 の連続区間 [start, endExclusive) を保持。
 * 大きめブラシでも 0 セルをスキップし O(filledPixels) 近似のループに短縮する。
 */
export interface ShapeMask {
  mask: Uint8Array; // 0 or 1
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  /** 内部キャッシュ (最初の使用時に生成) */
  _spansCache?: ShapeSpanRow[];
}

interface ShapeSpanRow {
  /** shape 内部座標系での行(y) */
  y: number;
  /** 連続区間 (end は排他的) */
  spans: Array<{ start: number; end: number }>;
}

interface PutShapeOptions {
  anvil: Anvil;
  shape: ShapeMask;
  posX: number; // centerX
  posY: number; // centerY
  color: RGBA;
  filter?: (x: number, y: number) => boolean; // true の時描画許可
  manualDiff?: boolean; // true なら変更前後を返却
  /**
   * (L2 部分最適化) ラインストローク中に共有される diff 集約マップ。
   * 既に同一ピクセルが登録済みなら再度 before 取得や書き込みをスキップ可能。
   */
  pixelAcc?: Map<string, { x: number; y: number; before: RGBA; after: RGBA }>;
}

/**
 * shape.mask から行スパンキャッシュを生成 (初回のみ)。
 */
function ensureShapeSpans(shape: ShapeMask) {
  if (shape._spansCache) return shape._spansCache;
  const { mask, width: mW, height: mH } = shape;
  const rows: ShapeSpanRow[] = [];
  for (let y = 0; y < mH; y++) {
    const base = y * mW;
    let runStart = -1;
    const spans: Array<{ start: number; end: number }> = [];
    for (let x = 0; x < mW; x++) {
      const v = mask[base + x];
      if (v === 1) {
        if (runStart === -1) runStart = x;
      } else if (runStart !== -1) {
        spans.push({ start: runStart, end: x });
        runStart = -1;
      }
    }
    if (runStart !== -1) spans.push({ start: runStart, end: mW });
    if (spans.length) rows.push({ y, spans });
  }
  shape._spansCache = rows;
  return rows;
}

export function putShape(opts: PutShapeOptions) {
  const { shape, anvil, posX, posY, color, filter, manualDiff, pixelAcc } = opts;
  if (!shape || shape.width <= 0 || shape.height <= 0) return undefined;

  const spans = ensureShapeSpans(shape);
  const { offsetX, offsetY } = shape;
  const targetWidth = anvil.getWidth();
  const targetHeight = anvil.getHeight();
  const tlX = posX + offsetX;
  const tlY = posY + offsetY;
  const target = anvil.getBufferData();

  const diffs: Array<{ x: number; y: number; before: RGBA; after: RGBA }> | undefined = manualDiff ? [] : undefined;

  for (const row of spans) {
    const ty = tlY + row.y;
    if (ty < 0 || ty >= targetHeight) continue;
    for (const span of row.spans) {
      let startX = tlX + span.start;
      let endXExclusive = tlX + span.end; // exclusive
      if (endXExclusive <= 0 || startX >= targetWidth) continue;
      if (startX < 0) startX = 0;
      if (endXExclusive > targetWidth) endXExclusive = targetWidth;
      for (let tx = startX; tx < endXExclusive; tx++) {
        if (filter && !filter(tx, ty)) continue;

        if (manualDiff) {
          const key = tx + ',' + ty;
          if (pixelAcc && pixelAcc.has(key)) {
            // 既にこの stroke 内で処理済みなので再書き込み不要 (同色前提)。
            continue;
          }
          const before = anvil.getPixel(tx, ty) as RGBA;
          const ti = (tx + ty * targetWidth) * 4;
          // anvil.setPixel は diff / tile コストが高いので manualDiff 経路では直接書き込む
          target[ti] = color[0];
          target[ti + 1] = color[1];
          target[ti + 2] = color[2];
          target[ti + 3] = color[3];
          const diff = { x: tx, y: ty, before, after: color };
          diffs!.push(diff);
          if (pixelAcc) pixelAcc.set(key, diff);
        } else {
          anvil.setPixel(tx, ty, color);
        }
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

  // 単一点なら従来処理
  if (fromPosX === posX && fromPosY === posY) {
    return putShape(opts);
  }

  // ====== Composite Line (L3) ======
  // 1. Bresenham で中心点列を収集しつつブラシ全体を含む bbox を算出
  const centers: Array<{ x: number; y: number }> = [];
  let x0 = fromPosX | 0;
  let y0 = fromPosY | 0;
  const x1 = posX | 0;
  const y1 = posY | 0;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  const spans = ensureShapeSpans(opts.shape);
  // shape の相対範囲
  let shapeMinX = Infinity;
  let shapeMaxX = -Infinity;
  let shapeMinY = Infinity;
  let shapeMaxY = -Infinity;
  for (const r of spans) {
    if (r.y < shapeMinY) shapeMinY = r.y;
    if (r.y > shapeMaxY) shapeMaxY = r.y;
    for (const s of r.spans) {
      if (s.start < shapeMinX) shapeMinX = s.start;
      if (s.end - 1 > shapeMaxX) shapeMaxX = s.end - 1;
    }
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  while (true) {
    centers.push({ x: x0, y: y0 });
    const cMinX = x0 + shapeMinX + opts.shape.offsetX;
    const cMaxX = x0 + shapeMaxX + opts.shape.offsetX;
    const cMinY = y0 + shapeMinY + opts.shape.offsetY;
    const cMaxY = y0 + shapeMaxY + opts.shape.offsetY;
    if (cMinX < minX) minX = cMinX;
    if (cMaxX > maxX) maxX = cMaxX;
    if (cMinY < minY) minY = cMinY;
    if (cMaxY > maxY) maxY = cMaxY;

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

  if (minX > maxX || minY > maxY) return manualDiff ? [] : undefined;

  // 2. BBox のサイズを計算し閾値超過ならフォールバック
  const targetW = opts.anvil.getWidth();
  const targetH = opts.anvil.getHeight();
  // キャンバス外に大幅にはみ出る場合を考慮しクリップした bbox 面積で閾値判断
  const clipMinX = Math.max(0, minX);
  const clipMinY = Math.max(0, minY);
  const clipMaxX = Math.min(targetW - 1, maxX);
  const clipMaxY = Math.min(targetH - 1, maxY);
  if (clipMinX > clipMaxX || clipMinY > clipMaxY) return manualDiff ? [] : undefined;
  const bboxW = (clipMaxX - clipMinX + 1) | 0;
  const bboxH = (clipMaxY - clipMinY + 1) | 0;
  const area = bboxW * bboxH;
  const MAX_COMPOSITE_AREA = 10_000_000; // 約 10M ピクセル閾値。超える場合はメモリ負荷大なのでフォールバック。
  // shape が極小 & 線が短い場合は従来 stamping の方が安い場合があるので簡易ヒューリスティック
  const stampingCostEst = centers.length * spans.length; // 粗い指標
  if (area > MAX_COMPOSITE_AREA || (area < stampingCostEst * 4 && !manualDiff)) {
    // フォールバック: 既存 stamping 方式
    let fallbackDiffs: Array<{ x: number; y: number; before: RGBA; after: RGBA }> | undefined;
    const diffMap: Map<string, { x: number; y: number; before: RGBA; after: RGBA }> = manualDiff ? new Map() : new Map();
    for (const c of centers) {
      if (manualDiff) {
        putShape({ ...opts, posX: c.x, posY: c.y, manualDiff: true, pixelAcc: diffMap });
      } else {
        putShape({ ...opts, posX: c.x, posY: c.y, manualDiff: false });
      }
    }
    if (manualDiff) {
      fallbackDiffs = Array.from(diffMap.values());
      return fallbackDiffs;
    }
    return undefined;
  }

  // 3. 合成マスク作成 (clip された領域分だけ確保)
  const maskW = bboxW;
  const maskH = bboxH;
  const mask = new Uint8Array(maskW * maskH); // 0/1

  for (const c of centers) {
    // 各中心
    for (const row of spans) {
      const gy = c.y + row.y + opts.shape.offsetY;
      if (gy < clipMinY || gy > clipMaxY) continue;
      const localY = gy - clipMinY;
      for (const s of row.spans) {
        let gx0 = c.x + s.start + opts.shape.offsetX;
        let gx1Exclusive = c.x + s.end + opts.shape.offsetX;
        if (gx1Exclusive <= clipMinX || gx0 > clipMaxX) continue;
        if (gx0 < clipMinX) gx0 = clipMinX;
        if (gx1Exclusive > clipMaxX + 1) gx1Exclusive = clipMaxX + 1;
        const base = localY * maskW;
        for (let gx = gx0; gx < gx1Exclusive; gx++) {
          const localX = gx - clipMinX;
          mask[base + localX] = 1;
        }
      }
    }
  }

  // 4. マスク適用
  let diffs: Array<{ x: number; y: number; before: RGBA; after: RGBA }> | undefined = manualDiff ? [] : undefined;
  const buf = opts.anvil.getBufferData();
  const color = opts.color;
  const filter = opts.filter;
  const canvasW = targetW;

  for (let localY = 0; localY < maskH; localY++) {
    const gy = clipMinY + localY;
    const rowBase = localY * maskW;
    for (let localX = 0; localX < maskW; localX++) {
      if (mask[rowBase + localX] !== 1) continue;
      const gx = clipMinX + localX;
      if (filter && !filter(gx, gy)) continue;
      if (manualDiff) {
        const before = opts.anvil.getPixel(gx, gy) as RGBA;
        const ti = (gx + gy * canvasW) * 4;
        buf[ti] = color[0];
        buf[ti + 1] = color[1];
        buf[ti + 2] = color[2];
        buf[ti + 3] = color[3];
        diffs!.push({ x: gx, y: gy, before, after: color });
      } else {
        opts.anvil.setPixel(gx, gy, color);
      }
    }
  }

  return diffs;
}
