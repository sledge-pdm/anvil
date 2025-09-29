// パターンの貼り付けを行う。
// 主にペン/消しゴム操作で使うことになるが、そのうちディザリンググラデーションやトーンで repeatable なパターンを貼り付ける場合もここに集約する。
// 現状: 最小実装 (単色/タイルパターン + 円形カバレッジ + normal / erase ブレンド)。将来的に以下を拡張予定:
// - 複数ブレンドモード (multiply / lighten など)
// - 行スパン / RLE 最適化
// - 外部提供 coverageMask をそのまま使う経路
// - rotate / scale / pattern wrap mode (mirror など)

import type { RGBA } from '../../types.js';

// Pattern: ひとまず最小。wrapX/Y は今は 'repeat' のみ対応。
export interface Pattern {
  width: number;
  height: number;
  data: Uint8ClampedArray; // RGBA 連続 (width * height * 4)
}

export interface PatternStampOptions {
  target: Uint8ClampedArray;
  targetWidth: number;
  targetHeight: number;
  centerX: number;
  centerY: number;
  pattern: Pattern;
  radius?: number; // 旧 circle カバレッジ方式用
  opacity?: number;
  blendMode?: 'normal' | 'erase';
  coverageMask?: Uint8Array;
  // 新: shape:size ベースのピクセルマスクを利用する経路。maskKey が指定され、shape/size も与えられればキャッシュから取得/生成。
  maskKey?: string; // 例: "circle:10" / "square:5"
  shape?: 'circle' | 'square';
  size?: number; // shape と組み合わせてマスク生成に使用
}

// PixelMask: PenTool から移管する形状マスク。値は 0/1。
export interface PixelMask {
  mask: Uint8Array; // 0 or 1
  width: number;
  height: number;
  offsetX: number; // 中心から左上まで
  offsetY: number;
}

// shape:size キーのキャッシュ
const pixelMaskCache: Map<string, PixelMask> = new Map();

function maskCacheKey(shape: 'circle' | 'square', size: number): string {
  return `${shape}:${size}`;
}

export function getOrCreateShapeMask(shape: 'circle' | 'square', size: number, key?: string): PixelMask {
  const finalKey = key ?? maskCacheKey(shape, size);
  let m = pixelMaskCache.get(finalKey);
  if (!m) {
    m = generateShapePixelMask(size, shape);
    pixelMaskCache.set(finalKey, m);
  }
  return m;
}

// 単色パターン生成ヘルパー
export function createSolidPattern(color: RGBA): Pattern {
  const data = new Uint8ClampedArray(4);
  data[0] = color[0];
  data[1] = color[1];
  data[2] = color[2];
  data[3] = color[3];
  return { width: 1, height: 1, data };
}

// 円形カバレッジマスク生成 (中心含む) 0..255
function generateCircleCoverage(radius: number): { mask: Uint8Array; size: number } {
  const r = Math.max(0, Math.floor(radius));
  const size = r * 2 + 1;
  const mask = new Uint8Array(size * size);
  const rr = r + 0.5; // アンチエイリアス簡易閾値 (中心補正)
  const rrSq = rr * rr;
  for (let y = 0; y < size; y++) {
    const dy = y - r;
    for (let x = 0; x < size; x++) {
      const dx = x - r;
      const distSq = dx * dx + dy * dy;
      if (distSq <= rrSq) {
        // 簡易的にフルカバレッジ。将来的にフェードを dist で計算しても良い。
        mask[y * size + x] = 255;
      }
    }
  }
  return { mask, size };
}

// PenDraw.ts の getDrawnPixelMask 相当: size, shape から最小バウンディング矩形マスク生成
function generateShapePixelMask(size: number, shape: 'circle' | 'square'): PixelMask {
  const coords: Array<{ x: number; y: number }> = [];
  const seen = new Set<string>();

  // 描画関数 (最小限) - 偶数サイズ時の中心合わせは PenDraw と同様ロジック
  const emit = (x: number, y: number) => {
    const k = `${x},${y}`;
    if (!seen.has(k)) {
      seen.add(k);
      coords.push({ x, y });
    }
  };

  // shape ごとの座標列挙
  if (shape === 'square') {
    let centerX = 0;
    let centerY = 0;
    const even = size % 2 === 0;
    // 偶数サイズは rawPosition=0 と仮定して Math.round(0)=0 で OK
    centerX = 0;
    centerY = 0;
    const half = Math.floor(size / 2);
    const start = -half;
    const end = size - half - 1;
    for (let dy = start; dy <= end; dy++) {
      for (let dx = start; dx <= end; dx++) {
        emit(centerX + dx, centerY + dy);
      }
    }
  } else {
    const even = size % 2 === 0;
    const centerX = 0;
    const centerY = 0;
    const radius = size / 2;
    const radiusSq = radius * radius;
    const bound = Math.ceil((size - 1) / 2);
    for (let dy = -bound; dy <= bound; dy++) {
      for (let dx = -bound; dx <= bound; dx++) {
        let pixelX: number, pixelY: number;
        if (even) {
          pixelX = Math.floor(centerX + dx);
          pixelY = Math.floor(centerY + dy);
          const deltaX = pixelX + 0.5 - centerX;
          const deltaY = pixelY + 0.5 - centerY;
          const d2 = deltaX * deltaX + deltaY * deltaY;
          if (d2 <= radiusSq) emit(pixelX, pixelY);
        } else {
          pixelX = centerX + dx;
          pixelY = centerY + dy;
          const d2 = dx * dx + dy * dy;
          if (d2 <= radiusSq) emit(pixelX, pixelY);
        }
      }
    }
  }

  if (coords.length === 0) return { mask: new Uint8Array(0), width: 0, height: 0, offsetX: 0, offsetY: 0 };

  let minX = coords[0].x,
    maxX = coords[0].x,
    minY = coords[0].y,
    maxY = coords[0].y;
  for (const { x, y } of coords) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const mask = new Uint8Array(width * height);
  for (const { x, y } of coords) {
    const ix = x - minX;
    const iy = y - minY;
    mask[iy * width + ix] = 1;
  }
  return { mask, width, height, offsetX: minX, offsetY: minY };
}

// ブレンド (normal, erase)。dst, src は 0..255。coverage, opacity は 0..1 へ正規化した後で使う。
function blendPixel(
  mode: 'normal' | 'erase',
  dst: Uint8ClampedArray,
  di: number,
  sr: number,
  sg: number,
  sb: number,
  sa: number,
  cov: number,
  opacity: number
) {
  if (mode === 'erase') {
    // アルファ減衰のみ。色は保持 (多くのペイント系挙動)。
    const factor = 1 - cov * opacity;
    dst[di + 3] = Math.round(dst[di + 3] * factor);
    return;
  }
  // normal
  const a = (sa / 255) * cov * opacity; // 0..1
  if (a <= 0) return;
  const inv = 1 - a;
  const da = dst[di + 3] / 255;
  const outA = a + da * inv; // 0..1
  // premultiplied 合成的計算 (簡易)
  dst[di + 0] = Math.round(sr * a + dst[di + 0] * inv);
  dst[di + 1] = Math.round(sg * a + dst[di + 1] * inv);
  dst[di + 2] = Math.round(sb * a + dst[di + 2] * inv);
  dst[di + 3] = Math.round(outA * 255);
}

// 最小スタンプ実装
export function patternStamp(opts: PatternStampOptions): void {
  const {
    target,
    targetWidth,
    targetHeight,
    centerX,
    centerY,
    pattern,
    radius,
    opacity = 1,
    blendMode = 'normal',
    coverageMask,
    maskKey,
    shape,
    size,
  } = opts;

  if (!target || targetWidth <= 0 || targetHeight <= 0) return; // 値が揃っていない
  if (!pattern || pattern.width <= 0 || pattern.height <= 0) return;

  // ピクセルマスク経路優先: maskKey+shape+size が揃っている場合
  if (maskKey && shape && typeof size === 'number') {
    const pixelMask = getOrCreateShapeMask(shape, size, maskKey);
    const { mask, width: mW, height: mH, offsetX, offsetY } = pixelMask;
    const pW = pattern.width;
    const pH = pattern.height;
    const pData = pattern.data;
    for (let iy = 0; iy < mH; iy++) {
      const ty = centerY + offsetY + iy;
      if (ty < 0 || ty >= targetHeight) continue;
      for (let ix = 0; ix < mW; ix++) {
        if (mask[iy * mW + ix] !== 1) continue;
        const tx = centerX + offsetX + ix;
        if (tx < 0 || tx >= targetWidth) continue;
        const px = ((tx % pW) + pW) % pW;
        const py = ((ty % pH) + pH) % pH;
        const pi = (py * pW + px) * 4;
        const sr = pData[pi];
        const sg = pData[pi + 1];
        const sb = pData[pi + 2];
        const sa = pData[pi + 3];
        if (sa === 0 && blendMode !== 'erase') continue;
        const di = (ty * targetWidth + tx) * 4;
        // ピクセルマスクは 0/1 なので cov = 1
        blendPixel(blendMode, target, di, sr, sg, sb, sa, 1, opacity);
      }
    }
    return;
  }

  // 旧 circle coverage 経路 (後方互換)
  const r = radius != null ? Math.max(0, Math.floor(radius)) : Math.max(pattern.width, pattern.height) >> 1;
  const circle = coverageMask ? { mask: coverageMask, size: Math.floor(Math.sqrt(coverageMask.length)) } : generateCircleCoverage(r);
  const cmask = circle.mask;
  const cSize = circle.size;
  if (cmask.length !== cSize * cSize) return; // square チェック
  const startX = centerX - r;
  const startY = centerY - r;
  const pW = pattern.width;
  const pH = pattern.height;
  const pData = pattern.data;
  for (let my = 0; my < cSize; my++) {
    const ty = startY + my;
    if (ty < 0 || ty >= targetHeight) continue;
    for (let mx = 0; mx < cSize; mx++) {
      const cov255 = cmask[my * cSize + mx];
      if (cov255 === 0) continue;
      const tx = startX + mx;
      if (tx < 0 || tx >= targetWidth) continue;
      const px = ((tx % pW) + pW) % pW;
      const py = ((ty % pH) + pH) % pH;
      const pi = (py * pW + px) * 4;
      const sr = pData[pi];
      const sg = pData[pi + 1];
      const sb = pData[pi + 2];
      const sa = pData[pi + 3];
      if (sa === 0 && blendMode !== 'erase') continue;
      const di = (ty * targetWidth + tx) * 4;
      blendPixel(blendMode, target, di, sr, sg, sb, sa, cov255 / 255, opacity);
    }
  }
}

// TODO: 将来的に stroke 経由 (連続 stamp) をまとめる API を追加予定。
