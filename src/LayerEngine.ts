import { PixelBuffer } from './buffer/PixelBuffer.js';
import { LayerDiffs } from './diff/LayerDiffs.js';
import { LayerDiffsController } from './diff/LayerDiffsController.js';
import type { Patch, PatchMetadata } from './patch.js';
import { LayerTiles } from './tile/LayerTiles.js';
import { LayerTilesController } from './tile/LayerTilesController.js';
import type { Point, RGBA, Size, TileIndex } from './types.js';
import { packedU32ToRgba } from './types.js';

/**
 * Anvil: Complete layer pixel processing engine
 * Integrates buffer, tiles, and diffs into a cohesive API
 */
export class Anvil {
  public readonly buffer: PixelBuffer;
  public readonly tileSize: number;

  private tiles: LayerTiles;
  private tilesController: LayerTilesController;
  private diffs: LayerDiffs;
  private diffsController: LayerDiffsController;

  // Optional callback for patch events
  private onPatchCallback?: (patch: Patch, metadata?: PatchMetadata) => void;

  constructor(
    size: Size,
    options?: {
      tileSize?: number;
      initialBuffer?: Uint8ClampedArray;
      onPatch?: (patch: Patch, metadata?: PatchMetadata) => void;
    }
  ) {
    this.tileSize = options?.tileSize ?? 32;
    this.buffer = new PixelBuffer(size.width, size.height, options?.initialBuffer);

    this.tiles = new LayerTiles(size.width, size.height, this.tileSize);
    this.tilesController = new LayerTilesController(this.tiles, this.buffer);

    this.diffs = new LayerDiffs();
    this.diffsController = new LayerDiffsController(this.diffs, this.tilesController, this.tileSize);

    this.onPatchCallback = options?.onPatch;
  }

  /**
   * Set a pixel and record the change for diff tracking
   */
  setPixel(
    x: number,
    y: number,
    color: RGBA,
    options?: {
      skipIfDiffExists?: boolean;
    }
  ): boolean {
    if (!this.buffer.isInBounds(x, y)) {
      return false;
    }

    // Check if we should skip due to existing diff
    if (options?.skipIfDiffExists && this.diffsController.hasPixelDiff(x, y)) {
      return false;
    }

    const before = this.buffer.get(x, y);
    const changed = this.buffer.set(x, y, color);

    if (changed) {
      // Record the change in diffs
      this.diffsController.addPixel(x, y, before, color);

      // Mark tile as dirty
      this.tilesController.markDirtyByPixel(x, y);
    }

    return changed;
  }

  /**
   * Fill an entire tile with a uniform color
   */
  fillTile(tileIndex: TileIndex, color: RGBA): boolean {
    const previousColor = this.tilesController.fillTile(tileIndex, color);

    // Record the tile fill in diffs
    this.diffsController.addTileFill(tileIndex, previousColor, color);

    return true;
  }

  /**
   * Resize the layer buffer
   */
  resize(
    newSize: Size,
    options?: {
      srcOrigin?: Point;
      destOrigin?: Point;
    }
  ): void {
    const oldBuffer = this.buffer.clone();

    this.buffer.resize(newSize, options);
    this.tilesController.resize(newSize.width, newSize.height);

    // Record whole buffer change
    this.diffsController.addWholeBufferChange(oldBuffer.data, this.buffer.data);

    // Mark all tiles as dirty after resize
    this.tilesController.setAllDirty();
  }

  /**
   * Apply a patch (for undo/redo operations)
   */
  applyPatch(patch: Patch, mode: 'undo' | 'redo'): void {
    // Apply whole buffer changes first
    if (patch.whole) {
      const targetData = mode === 'undo' ? patch.whole.before : patch.whole.after;
      this.buffer.data.set(targetData);
      this.tilesController.setAllDirty();
    }

    // Apply tile fills
    if (patch.tiles) {
      for (const tilePatch of patch.tiles) {
        const targetPacked =
          mode === 'undo'
            ? (tilePatch.before ?? 0) // TODO: handle undefined case better
            : tilePatch.after;

        const targetColor = packedU32ToRgba(targetPacked);
        this.tilesController.fillTile(tilePatch.tile, targetColor);
      }
    }

    // Apply pixel changes
    if (patch.pixels) {
      for (const pixelPatch of patch.pixels) {
        const targetValues = mode === 'undo' ? pixelPatch.before : pixelPatch.after;
        const bounds = this.tiles.getTileBounds(pixelPatch.tile);

        for (let i = 0; i < pixelPatch.idx.length; i++) {
          const tileLocalIndex = pixelPatch.idx[i];
          const localX = tileLocalIndex % this.tileSize;
          const localY = Math.floor(tileLocalIndex / this.tileSize);
          const globalX = bounds.x + localX;
          const globalY = bounds.y + localY;

          const targetColor = packedU32ToRgba(targetValues[i]);
          this.buffer.set(globalX, globalY, targetColor);
        }

        // Mark tile as dirty
        this.tiles.setDirty(pixelPatch.tile, true);
      }
    }
  }

  /**
   * Get current dirty tiles (for renderer integration)
   */
  getDirtyTiles(): TileIndex[] {
    return this.tilesController.getDirtyTiles().map((info) => info.index);
  }

  /**
   * Clear all dirty flags
   */
  clearDirtyFlags(): void {
    this.tilesController.clearAllDirty();
  }

  /**
   * Flush accumulated diffs into a patch
   */
  flush(metadata?: PatchMetadata): Patch | undefined {
    const patch = this.diffsController.flush();

    if (patch && this.onPatchCallback) {
      this.onPatchCallback(patch, metadata);
    }

    return patch;
  }

  /**
   * Check if there are pending changes
   */
  hasPendingChanges(): boolean {
    return this.diffsController.hasPendingChanges();
  }

  /**
   * Get count of pending pixel changes
   */
  getPendingPixelCount(): number {
    return this.diffsController.getPendingPixelCount();
  }

  /**
   * Discard pending changes without creating a patch
   */
  discardPendingChanges(): void {
    this.diffsController.discardPendingChanges();
  }

  /**
   * Set the patch callback
   */
  setOnPatchCallback(callback: (patch: Patch, metadata?: PatchMetadata) => void): void {
    this.onPatchCallback = callback;
  }

  /**
   * Get comprehensive statistics
   */
  getStats(): {
    buffer: { width: number; height: number; byteLength: number };
    tiles: { totalTiles: number; dirtyTiles: number; uniformTiles: number; memoryUsage: number };
    diffs: { hasPending: boolean; pendingPixels: number; memoryUsage: number };
  } {
    return {
      buffer: {
        width: this.buffer.width,
        height: this.buffer.height,
        byteLength: this.buffer.data.byteLength,
      },
      tiles: this.tilesController.getStats(),
      diffs: this.diffsController.getDebugInfo(),
    };
  }

  /**
   * Validate internal consistency (debugging helper)
   */
  validate(): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check buffer size consistency
    const expectedBufferSize = this.buffer.width * this.buffer.height * 4;
    if (this.buffer.data.length !== expectedBufferSize) {
      errors.push(`Buffer size mismatch: expected ${expectedBufferSize}, got ${this.buffer.data.length}`);
    }

    // Check tile grid consistency
    const expectedCols = Math.ceil(this.buffer.width / this.tileSize);
    const expectedRows = Math.ceil(this.buffer.height / this.tileSize);
    if (this.tiles.cols !== expectedCols || this.tiles.rows !== expectedRows) {
      errors.push(`Tile grid mismatch: expected ${expectedRows}x${expectedCols}, got ${this.tiles.rows}x${this.tiles.cols}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
