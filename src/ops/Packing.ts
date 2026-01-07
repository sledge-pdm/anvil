import { rawToWebp, RGBA } from '@sledge-pdm/core';
import type { PackedPartialPatchData, PartialPatchData } from '../types/patch/partial';
import type { PackedDiffs, PendingDiffs } from '../types/patch/Patch';
import type { PackedPixelPatchData, PixelPatchData } from '../types/patch/pixel';
import type { PackedWholePatchData, WholePatchData } from '../types/patch/whole';
import type { TileIndex } from '../types/types';

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
