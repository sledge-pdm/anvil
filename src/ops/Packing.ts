import { png_to_raw, raw_to_png, raw_to_webp, webp_to_raw } from '../ops_wasm/pkg/anvil_ops_wasm';
import { PackedPartialPatchData, PartialPatchData } from '../types/patch/partial';
import { PackedDiffs, PendingDiffs } from '../types/patch/Patch';
import { PackedPixelPatchData, PixelPatchData } from '../types/patch/pixel';
import { PackedWholePatchData, WholePatchData } from '../types/patch/whole';
import type { RawPixelData } from '../types/rawBuffer';
import { toUint8Array } from '../types/rawBuffer';
import { RGBA, TileIndex } from '../types/types';

export function rawToWebp(buffer: RawPixelData, width: number, height: number): Uint8Array {
  const start = performance.now();
  const uint8Buffer = toUint8Array(buffer);
  const webpBuffer = raw_to_webp(uint8Buffer, width, height);
  const end = performance.now();

  const compressed = (webpBuffer.length / buffer.length) * 100;
  console.log(
    `rawToWebp: ${end - start}ms, size: ${buffer.length} > ${webpBuffer.length} bytes (compressed 100% > ${Math.round(compressed * 100) / 100}%)`
  );

  return new Uint8Array(webpBuffer.buffer);
}

export function webpToRaw(buffer: Uint8Array, width: number, height: number): Uint8Array {
  const start = performance.now();
  const rawBuffer = webp_to_raw(buffer, width, height);
  const end = performance.now();

  const compressed = (buffer.length / rawBuffer.length) * 100;
  console.log(
    `webpToRaw: ${end - start}ms, size: ${buffer.length} > ${rawBuffer.length} bytes (decompressed ${Math.round(compressed * 100) / 100}% > 100%)`
  );

  return new Uint8Array(rawBuffer.buffer);
}

export function rawToPng(buffer: Uint8Array, width: number, height: number): Uint8Array {
  const start = performance.now();
  const pngBuffer = raw_to_png(buffer, width, height);
  const end = performance.now();

  const compressed = (pngBuffer.length / buffer.length) * 100;
  console.log(
    `rawToPng: ${end - start}ms, size: ${buffer.length} > ${pngBuffer.length} bytes (compressed 100% > ${Math.round(compressed * 100) / 100}%)`
  );

  return new Uint8Array(pngBuffer.buffer);
}

export function pngToRaw(buffer: Uint8Array, width: number, height: number): Uint8Array {
  const start = performance.now();
  const rawBuffer = png_to_raw(buffer, width, height);
  const end = performance.now();

  const compressed = (buffer.length / rawBuffer.length) * 100;
  console.log(
    `pngToRaw: ${end - start}ms, size: ${buffer.length} > ${rawBuffer.length} bytes (decompressed ${Math.round(compressed * 100) / 100}% > 100%)`
  );

  return new Uint8Array(rawBuffer.buffer);
}

// Utility functions for color conversion
export function rgbaToPackedU32(rgba: RGBA): number {
  return (rgba[3] << 24) | (rgba[0] << 16) | (rgba[1] << 8) | rgba[2];
}

export function packedU32ToRgba(packed: number): RGBA {
  return [(packed >> 16) & 0xff, (packed >> 8) & 0xff, packed & 0xff, (packed >>> 24) & 0xff];
}

export function tileIndexToLinear(index: TileIndex, cols: number): number {
  return index.row * cols + index.col;
}

export function linearToTileIndex(linear: number, cols: number): TileIndex {
  return {
    row: Math.floor(linear / cols),
    col: linear % cols,
  };
}

export function packPixels(diffs: PixelPatchData[]): PackedPixelPatchData[] {
  return diffs.map((px) => {
    return {
      x: px.x,
      y: px.y,
      color: rgbaToPackedU32(px.color),
    };
  });
}

export function packWhole(diff: WholePatchData): PackedWholePatchData {
  const { swapBuffer, width, height } = diff;
  const webpBuffer = rawToWebp(swapBuffer, width, height);
  return {
    swapBufferWebp: webpBuffer,
    width,
    height,
  };
}

export function packPartial(diff: PartialPatchData): PackedPartialPatchData {
  const { boundBox, swapBuffer } = diff;
  const webpBuffer = rawToWebp(swapBuffer, boundBox.width, boundBox.height);

  return {
    boundBox,
    swapBufferWebp: webpBuffer,
  };
}

export function packPending(pendingDiffs: PendingDiffs): PackedDiffs {
  const packed: PackedDiffs = {};

  if (pendingDiffs.whole) {
    packed.whole = pendingDiffs.whole;
  }
  if (pendingDiffs.partial) {
    packed.partial = pendingDiffs.partial;
  }

  // Pixel changes - convert to the Patch format
  if (pendingDiffs.pixels.length > 0) {
    packed.pixels = packPixels(pendingDiffs.pixels);
  }

  return packed;
}
