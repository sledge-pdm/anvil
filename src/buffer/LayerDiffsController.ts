import { packPending, tileKey } from '../ops/packing/Packing.js';
import { PartialPatchData } from '../types/patch/partial.js';
import type { PackedDiffs, PendingDiffs } from '../types/patch/Patch.js';
import { PixelPatchData } from '../types/patch/pixel.js';
import { TileFillPatchData } from '../types/patch/tileFill.js';
import { WholePatchData } from '../types/patch/whole.js';
import { LayerTilesController } from './LayerTilesController.js';

export class LayerDiffsController {
  diffs: PendingDiffs = {
    pixels: [],
    tileFills: new Map(),
    partial: undefined,
    whole: undefined,
  };

  constructor(
    private tilesController: LayerTilesController,
    private tileSize: number
  ) {}

  addPixel(unpacked: PixelPatchData) {
    this.diffs.pixels.push(unpacked);
  }

  addTileFill(unpacked: TileFillPatchData) {
    const key = tileKey(unpacked.tileIndex);
    this.diffs.tileFills.set(key, unpacked);
  }

  addPartial(unpacked: PartialPatchData) {
    const { boundBox, swapBuffer } = unpacked;
    const expected = boundBox.width * boundBox.height * 4;
    if (swapBuffer.length !== expected) throw new Error(`partial buffer length ${swapBuffer.length} does not match bbox area * 4 = ${expected}`);
    this.diffs.partial = unpacked;
    // Clear fine-grained diffs (they are superseded)
    this.diffs.pixels = [];
    this.diffs.tileFills.clear();
  }

  addWhole(unpacked: WholePatchData) {
    this.diffs.whole = unpacked;
    this.diffs.partial = undefined;
    this.diffs.pixels = [];
    this.diffs.tileFills.clear();
  }

  /**
   * Check if there are pending changes
   */
  hasPendingChanges(): boolean {
    return this.diffs.pixels.length > 0 || this.diffs.tileFills.size > 0 || this.diffs.partial !== undefined || this.diffs.whole !== undefined;
  }

  /**
   * Flush accumulated changes into a Patch and clear internal state
   */
  flush(): PackedDiffs | undefined {
    if (!this.hasPendingChanges()) {
      return undefined;
    }

    const patch: PackedDiffs = packPending(this.diffs);

    // Clear accumulated changes
    this.discardPendingChanges();

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
  discardPendingChanges(): void {
    this.diffs.pixels = [];
    this.diffs.tileFills.clear();
    this.diffs.partial = undefined;
    this.diffs.whole = undefined;
  }
}
