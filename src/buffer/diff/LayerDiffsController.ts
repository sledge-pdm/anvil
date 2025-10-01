import type { Patch } from '../../patch.js';
import type { RGBA, TileIndex } from '../../types.js';
import { LayerTilesController } from '../tile/LayerTilesController.js';
import { LayerDiffs } from './LayerDiffs.js';

/**
 * Controller: High-level diff operations and patch generation
 * Responsible for: business logic, patch creation, coordinate translation
 */
export class LayerDiffsController {
  constructor(
    private diffs: LayerDiffs,
    private tilesController: LayerTilesController,
    private tileSize: number
  ) {}

  /**
   * Add a pixel change by global coordinates
   */
  addPixel(x: number, y: number, before: RGBA, after: RGBA): void {
    const tile = this.tilesController['tiles'].pixelToTileIndex(x, y);
    const bounds = this.tilesController['tiles'].getTileBounds(tile);

    // Convert to tile-local coordinates
    const localX = x - bounds.x;
    const localY = y - bounds.y;
    const tileLocalIndex = localY * this.tileSize + localX;

    this.diffs.addPixelChange(tile, tileLocalIndex, before, after);
  }

  /**
   * Add a tile fill operation
   */
  addTileFill(tile: TileIndex, before: RGBA | undefined, after: RGBA): void {
    this.diffs.addTileFill(tile, before, after);
  }

  /**
   * Add whole buffer replacement
   */
  addWholeBufferChange(before: Uint8ClampedArray, after: Uint8ClampedArray): void {
    this.diffs.addWholeBufferChange(before, after);
  }

  /**
   * Check if there are pending changes
   */
  hasPendingChanges(): boolean {
    return this.diffs.hasPendingChanges();
  }

  /**
   * Get count of pending pixel changes
   */
  getPendingPixelCount(): number {
    return this.diffs.getPendingPixelCount();
  }

  /**
   * Check if a specific pixel has a pending diff
   */
  hasPixelDiff(x: number, y: number): boolean {
    const tile = this.tilesController['tiles'].pixelToTileIndex(x, y);
    const bounds = this.tilesController['tiles'].getTileBounds(tile);

    const localX = x - bounds.x;
    const localY = y - bounds.y;
    const tileLocalIndex = localY * this.tileSize + localX;

    return this.diffs.hasPixelChange(tile, tileLocalIndex);
  }

  clearDiffs() {
    this.diffs.clear();
  }

  /**
   * Flush accumulated changes into a Patch and clear internal state
   */
  flush(): Patch | undefined {
    if (!this.diffs.hasPendingChanges()) {
      return undefined;
    }

    const pending = this.diffs.getPendingChanges();
    const patch: Patch = {};

    // Whole buffer changes
    if (pending.wholeBuffer) {
      patch.whole = pending.wholeBuffer;
    }

    // Partial buffer change
    if (pending.partialBuffer) {
      patch.partial = pending.partialBuffer;
    }

    // Tile fills
    if (pending.tileFills.length > 0) {
      patch.tiles = pending.tileFills;
    }

    // Pixel changes - convert to the Patch format
    if (pending.pixelChanges.length > 0) {
      patch.pixels = pending.pixelChanges.map((change) => ({
        tile: change.tile,
        idx: new Uint16Array(change.indices),
        before: new Uint32Array(change.beforeValues),
        after: new Uint32Array(change.afterValues),
      }));
    }

    // Clear accumulated changes
    this.diffs.clear();

    return patch;
  }

  /**
   * Force flush without clearing (for preview/inspection)
   */
  previewPatch(): Patch | undefined {
    if (!this.diffs.hasPendingChanges()) {
      return undefined;
    }

    const pending = this.diffs.getPendingChanges();
    const patch: Patch = {};

    if (pending.wholeBuffer) {
      patch.whole = pending.wholeBuffer;
    }

    if (pending.partialBuffer) {
      patch.partial = pending.partialBuffer;
    }

    if (pending.tileFills.length > 0) {
      patch.tiles = pending.tileFills;
    }

    if (pending.pixelChanges.length > 0) {
      patch.pixels = pending.pixelChanges.map((change) => ({
        tile: change.tile,
        idx: new Uint16Array(change.indices),
        before: new Uint32Array(change.beforeValues),
        after: new Uint32Array(change.afterValues),
      }));
    }

    return patch;
  }

  /**
   * Clear all pending changes without creating a patch
   */
  discardPendingChanges(): void {
    this.diffs.clear();
  }

  /**
   * Get memory usage of accumulated diffs
   */
  getMemoryUsage(): number {
    return this.diffs.getMemoryUsage();
  }

  /**
   * Get debugging information about current diff state
   */
  getDebugInfo(): {
    hasPending: boolean;
    pendingPixels: number;
    memoryUsage: number;
    hasWhole: boolean;
    tileCount: number;
    pixelTileCount: number;
  } {
    const pending = this.diffs.getPendingChanges();

    return {
      hasPending: this.diffs.hasPendingChanges(),
      pendingPixels: this.diffs.getPendingPixelCount(),
      memoryUsage: this.diffs.getMemoryUsage(),
      hasWhole: !!pending.wholeBuffer,
      tileCount: pending.tileFills.length,
      pixelTileCount: pending.pixelChanges.length,
    };
  }
}
