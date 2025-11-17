import { packPartial, packPending, packWhole } from '../ops/Packing.js';
import type { PartialPatchData } from '../types/patch/partial.js';
import type { PackedDiffs, PendingDiffs } from '../types/patch/Patch.js';
import type { PixelPatchData } from '../types/patch/pixel.js';
import type { PackedWholePatchData, WholePatchData } from '../types/patch/whole.js';

export class DiffsController {
  diffs: PendingDiffs = {
    pixels: [],
    partial: undefined,
    whole: undefined,
  };

  constructor() {}

  addPixel(unpacked: PixelPatchData) {
    this.diffs.pixels.push(unpacked);
  }

  addPartial(unpacked: PartialPatchData) {
    const { boundBox, swapBuffer } = unpacked;
    const expected = boundBox.width * boundBox.height * 4;
    if (swapBuffer.byteLength !== expected)
      throw new Error(`partial buffer length ${swapBuffer.byteLength} does not match bbox area * 4 = ${expected}`);

    this.diffs.partial = packPartial(unpacked);
    this.diffs.pixels = [];
  }

  addWhole(unpacked: WholePatchData) {
    this.diffs.whole = packWhole(unpacked);
    this.diffs.partial = undefined;
    this.diffs.pixels = [];
  }

  addWholePacked(packed: PackedWholePatchData) {
    this.diffs.whole = packed;
    this.diffs.partial = undefined;
    this.diffs.pixels = [];
  }

  /**
   * Check if there are pending changes
   */
  hasPendingChanges(): boolean {
    return this.diffs.pixels.length > 0 || this.diffs.partial !== undefined || this.diffs.whole !== undefined;
  }

  /**
   * Flush accumulated changes into a Patch and clear internal state
   */
  flush(): PackedDiffs | undefined {
    if (!this.hasPendingChanges()) {
      return undefined;
    }
    const patch: PackedDiffs = packPending(this.diffs);
    this.discard();
    return patch;
  }

  /**
   * Force flush without clearing (for preview/inspection)
   */
  previewPatch(): PackedDiffs | undefined {
    if (!this.hasPendingChanges()) {
      return undefined;
    }

    const patch: PackedDiffs = packPending(this.diffs);

    return patch;
  }

  /**
   * Clear all pending changes without creating a patch
   */
  discard(): void {
    this.diffs.pixels = [];
    this.diffs.partial = undefined;
    this.diffs.whole = undefined;
  }
}
