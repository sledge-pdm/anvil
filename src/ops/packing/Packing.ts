import { png_to_raw, raw_to_png, raw_to_webp, webp_to_raw } from '../../ops_wasm/pkg/anvil_ops_wasm';
import { PackedDiffs, PendingDiffs } from '../../types/patch/Patch';
import { RGBA, TileIndex } from '../../types/types';

export function rawToWebp(buffer: Uint8Array, width: number, height: number): Uint8Array {
  const start = performance.now();
  const webpBuffer = raw_to_webp(buffer, width, height);
  const end = performance.now();

  const compressed = (webpBuffer.length / buffer.length) * 100;
  console.log(
    `rawToWebp: ${end - start}ms, size: ${buffer.length} > ${webpBuffer.length} bytes (compressed 100% > ${Math.round(compressed * 100) / 100}%)`
  );

  return webpBuffer;
}

export function webpToRaw(buffer: Uint8Array, width: number, height: number): Uint8Array {
  const start = performance.now();
  const rawBuffer = webp_to_raw(buffer, width, height);
  const end = performance.now();

  const compressed = (buffer.length / rawBuffer.length) * 100;
  console.log(
    `webpToRaw: ${end - start}ms, size: ${buffer.length} > ${rawBuffer.length} bytes (decompressed ${Math.round(compressed * 100) / 100}% > 100%)`
  );

  return rawBuffer;
}

export function rawToPng(buffer: Uint8Array, width: number, height: number): Uint8Array {
  const start = performance.now();
  const pngBuffer = raw_to_png(buffer, width, height);
  const end = performance.now();

  const compressed = (pngBuffer.length / buffer.length) * 100;
  console.log(
    `rawToPng: ${end - start}ms, size: ${buffer.length} > ${pngBuffer.length} bytes (compressed 100% > ${Math.round(compressed * 100) / 100}%)`
  );

  return pngBuffer;
}

export function pngToRaw(buffer: Uint8Array, width: number, height: number): Uint8Array {
  const start = performance.now();
  const rawBuffer = png_to_raw(buffer, width, height);
  const end = performance.now();

  const compressed = (buffer.length / rawBuffer.length) * 100;
  console.log(
    `pngToRaw: ${end - start}ms, size: ${buffer.length} > ${rawBuffer.length} bytes (decompressed ${Math.round(compressed * 100) / 100}% > 100%)`
  );

  return rawBuffer;
}

export function tileKey(tile: TileIndex) {
  return `${tile.row},${tile.col}`;
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

export function packPending(pendingDiffs: PendingDiffs): PackedDiffs {
  const packed: PackedDiffs = {}; // Whole buffer changes - convert to WebP
  if (pendingDiffs.whole) {
    const { swapBuffer, width, height } = pendingDiffs.whole;
    const webpBuffer = rawToWebp(new Uint8Array(swapBuffer.buffer, swapBuffer.byteOffset, swapBuffer.byteLength), width, height);
    packed.whole = {
      swapBufferWebp: webpBuffer,
      width,
      height,
    };
  }

  // Partial buffer change - convert to WebP
  if (pendingDiffs.partial) {
    const { boundBox, swapBuffer } = pendingDiffs.partial;
    const webpBuffer = rawToWebp(new Uint8Array(swapBuffer.buffer, swapBuffer.byteOffset, swapBuffer.byteLength), boundBox.width, boundBox.height);

    packed.partial = {
      boundBox,
      swapBufferWebp: webpBuffer,
    };
  }

  // Tile fills
  if (pendingDiffs.tileFills.size > 0) {
    packed.tiles = Object.values(pendingDiffs.tileFills).map((tf) => {
      return {
        tileIndex: tf.tileIndex,
        before: tf.before && rgbaToPackedU32(tf.before),
        after: rgbaToPackedU32(tf.after),
      };
    });
  }

  // Pixel changes - convert to the Patch format
  if (pendingDiffs.pixels.length > 0) {
    packed.pixels = pendingDiffs.pixels.map((px) => {
      return {
        x: px.x,
        y: px.y,
        color: rgbaToPackedU32(px.color),
      };
    });
  }

  return packed;
}
