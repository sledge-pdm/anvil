/* tslint:disable */
/* eslint-disable */
export function resize(buffer: Uint8Array, old_width: number, old_height: number, new_width: number, new_height: number, src_origin_x: number, src_origin_y: number, dest_origin_x: number, dest_origin_y: number): Uint8Array;
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
export function patch_buffer_rgba(target: Uint8Array, target_width: number, target_height: number, patch: Uint8Array, patch_width: number, patch_height: number, offset_x: number, offset_y: number): Uint8Array;
