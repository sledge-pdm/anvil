import { RGBA, Vec2 } from '@sledge-pdm/core';
import { packedU32ToRgba, rgbaToPackedU32 } from '../ops/Packing';
import type { PackedDiffs } from '../types/patch/Patch';
import { toUint8Array, toUint8ClampedArray } from '../types/rawBuffer';
import { RgbaBuffer } from '../wasm/pkg/anvil_wasm';

export class Buffer {
  private buffer: RgbaBuffer;

  constructor(width: number, height: number, tileSize = 32) {
    this.buffer = new RgbaBuffer(width, height /** tileSize */);
  }

  getWidth(): number {
    return this.buffer.width();
  }

  getHeight(): number {
    return this.buffer.height();
  }

  getPixel(pos: Vec2): RGBA {
    return this.buffer.get(pos.x, pos.y) as RGBA;
  }

  // don't even emit diff here
  setPixel(pos: Vec2, color: RGBA) {
    this.buffer.set(pos.x, pos.y, ...color);
  }

  getPartialBuffer(boundBox: { x: number; y: number; width: number; height: number }): Uint8ClampedArray {
    const { x, y, width: w, height: h } = boundBox;
    if (w <= 0 || h <= 0) {
      return new Uint8ClampedArray(0);
    }
    return toUint8ClampedArray(this.buffer.readRect(x, y, w, h));
  }

  setPartialBuffer(boundBox: { x: number; y: number; width: number; height: number }, source: Uint8ClampedArray): void {
    const { x, y, width: w, height: h } = boundBox;
    if (w <= 0 || h <= 0) return;
    this.buffer.writeRect(x, y, w, h, toUint8Array(source));
  }

  exportWebp(): Uint8Array {
    return this.buffer.exportWebp();
  }

  importWebp(buffer: Uint8Array, width: number, height: number): boolean {
    return this.buffer.importWebp(buffer, width, height);
  }

  applyPatch(patch: PackedDiffs | null, mode: 'undo' | 'redo') {
    if (!patch) {
      console.warn(`applyPatch: patch is null (${mode})`);
      return;
    }

    if (patch.whole) {
      const currentBuffer = this.exportWebp();
      this.importWebp(patch.whole.swapBufferWebp, this.getWidth(), this.getHeight());
      patch.whole.swapBufferWebp = currentBuffer;
    }

    if (patch.partial) {
      const { boundBox, swapBufferWebp } = patch.partial;
      const decodedBuffer = RgbaBuffer.fromWebp(boundBox.width, boundBox.height, swapBufferWebp);
      const currentPartial = this.getPartialBuffer(boundBox);
      const currentBuffer = RgbaBuffer.fromRaw(boundBox.width, boundBox.height, toUint8Array(currentPartial));
      const decoded = currentBuffer.exportWebp();

      this.setPartialBuffer(boundBox, toUint8ClampedArray(decodedBuffer.data()));
      patch.partial.swapBufferWebp = decoded;
    }

    patch.pixels = patch.pixels?.map((p) => {
      const colorUnpacked = packedU32ToRgba(p.color);

      const swapColor = this.getPixel({ x: p.x, y: p.y });
      this.setPixel({ x: p.x, y: p.y }, colorUnpacked);
      return { x: p.x, y: p.y, color: rgbaToPackedU32(swapColor) };
    });
  }
}
