/* tslint:disable */
/* eslint-disable */
/**
 * スキャンライン方式のFloodFill実装
 *
 * この実装は以下の特徴を持ちます：
 * - メモリ効率的なスキャンライン方式
 * - スタックオーバーフロー回避
 * - 高速な隣接色判定
 * - 選択範囲制限サポート
 */
export function scanline_flood_fill(buffer: Uint8Array, width: number, height: number, start_x: number, start_y: number, fill_color_r: number, fill_color_g: number, fill_color_b: number, fill_color_a: number, threshold: number): boolean;
/**
 * 選択範囲制限付きスキャンライン FloodFill
 */
export function scanline_flood_fill_with_mask(buffer: Uint8Array, width: number, height: number, start_x: number, start_y: number, fill_color_r: number, fill_color_g: number, fill_color_b: number, fill_color_a: number, threshold: number, selection_mask: Uint8Array, limit_mode: string): boolean;
export function raw_to_webp(buffer: Uint8Array, width: number, height: number): Uint8Array;
export function webp_to_raw(webp_buffer: Uint8Array, width: number, height: number): Uint8Array;
export function raw_to_png(buffer: Uint8Array, width: number, height: number): Uint8Array;
export function png_to_raw(png_buffer: Uint8Array, _width: number, _height: number): Uint8Array;
export function resize(buffer: Uint8Array, old_width: number, old_height: number, new_width: number, new_height: number, src_origin_x: number, src_origin_y: number, dest_origin_x: number, dest_origin_y: number): Uint8Array;
export function patch_buffer_rgba(target: Uint8Array, target_width: number, target_height: number, patch: Uint8Array, patch_width: number, patch_height: number, offset_x: number, offset_y: number, options: PatchBufferRgbaOption): Uint8Array;
export function patch_buffer_rgba_instant(target: Uint8Array, target_width: number, target_height: number, patch: Uint8Array, patch_width: number, patch_height: number, offset_x: number, offset_y: number, scale_x: number, scale_y: number, rotate_deg: number, options: PatchBufferRgbaOption): void;
export enum AntialiasMode {
  Nearest = 0,
  Bilinear = 1,
  Bicubic = 2,
}
export class PatchBufferRgbaOption {
  free(): void;
  [Symbol.dispose](): void;
  constructor(antialias_mode: AntialiasMode, flip_x: boolean, flip_y: boolean);
  antialias_mode: AntialiasMode;
  flip_x: boolean;
  flip_y: boolean;
}
export class RgbaBuffer {
  free(): void;
  [Symbol.dispose](): void;
  constructor(width: number, height: number);
  width(): number;
  height(): number;
  len(): number;
  is_empty(): boolean;
  ptr(): number;
  data(): Uint8ClampedArray;
  exportWebp(): Uint8Array;
  exportPng(): Uint8Array;
  importRaw(raw: Uint8Array, width: number, height: number): boolean;
  importWebp(webp_buffer: Uint8Array, width: number, height: number): boolean;
  importPng(png_buffer: Uint8Array, width: number, height: number): boolean;
  resize_instant(new_width: number, new_height: number, src_origin_x: number, src_origin_y: number, dest_origin_x: number, dest_origin_y: number): void;
  floodFill(start_x: number, start_y: number, fill_color_r: number, fill_color_g: number, fill_color_b: number, fill_color_a: number, threshold: number): boolean;
  floodFillWithMask(start_x: number, start_y: number, fill_color_r: number, fill_color_g: number, fill_color_b: number, fill_color_a: number, threshold: number, selection_mask: Uint8Array, limit_mode: string): boolean;
  blitFromRaw(source: Uint8Array, source_width: number, source_height: number, offset_x: number, offset_y: number, scale_x: number, scale_y: number, rotate_deg: number, antialias_mode: AntialiasMode, flip_x: boolean, flip_y: boolean): void;
  blitFromBuffer(source: RgbaBuffer, offset_x: number, offset_y: number, scale_x: number, scale_y: number, rotate_deg: number, antialias_mode: AntialiasMode, flip_x: boolean, flip_y: boolean): void;
  sliceWithMask(mask: Uint8Array, mask_width: number, mask_height: number, mask_offset_x: number, mask_offset_y: number): Uint8Array;
  cropWithMask(mask: Uint8Array, mask_width: number, mask_height: number, mask_offset_x: number, mask_offset_y: number): Uint8Array;
}
