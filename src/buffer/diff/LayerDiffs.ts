import type { RGBA, TileIndex } from '../../types.js';
import { rgbaToPackedU32 } from '../../types.js';

/**
 * Model: Accumulates pending diffs before flush into Patch
 * Responsible for: efficient storage of pixel changes, tile fills
 */
export class LayerDiffs {
  // Pixel-level changes grouped by tile
  private pixelDiffs: Map<
    string,
    {
      tile: TileIndex;
      changes: Map<number, { before: number; after: number }>; // tileLocalIndex -> packed RGBA32
    }
  > = new Map();

  // Tile-level uniform fills
  private tileFills: Map<
    string,
    {
      tile: TileIndex;
      before?: number; // packed RGBA32, undefined if was non-uniform
      after: number; // packed RGBA32
    }
  > = new Map();

  // Partial buffer replacements (Rect)
  private partialBufferChange?: {
    boundBox: { x: number; y: number; width: number; height: number };
    before: Uint8ClampedArray; // should be boundBox.width * boundBox.height * 4
    after: Uint8ClampedArray; // should be boundBox.width * boundBox.height * 4
  };

  // Whole buffer replacements (rare, for canvas resize etc)
  private wholeBufferChange?: {
    before: Uint8ClampedArray;
    after: Uint8ClampedArray;
  };

  getDiffs() {
    return {
      pixel: this.pixelDiffs,
      tile: this.tileFills,
      whole: this.wholeBufferChange,
      partial: this.partialBufferChange,
    };
  }

  /**
   * Add a pixel-level change
   */
  addPixelChange(tile: TileIndex, tileLocalIndex: number, before: RGBA, after: RGBA): void {
    const tileKey = `${tile.row},${tile.col}`;

    if (!this.pixelDiffs.has(tileKey)) {
      this.pixelDiffs.set(tileKey, {
        tile,
        changes: new Map(),
      });
    }

    const tileDiff = this.pixelDiffs.get(tileKey)!;
    tileDiff.changes.set(tileLocalIndex, {
      before: rgbaToPackedU32(before),
      after: rgbaToPackedU32(after),
    });
  }

  /**
   * Add a tile-level uniform fill
   */
  addTileFill(tile: TileIndex, before: RGBA | undefined, after: RGBA): void {
    const tileKey = `${tile.row},${tile.col}`;

    this.tileFills.set(tileKey, {
      tile,
      before: before ? rgbaToPackedU32(before) : undefined,
      after: rgbaToPackedU32(after),
    });

    // Remove any pixel-level changes for this tile (tile fill overrides)
    this.pixelDiffs.delete(tileKey);
  }

  /**
   * Add a whole buffer replacement
   */
  addWholeBufferChange(before: Uint8ClampedArray, after: Uint8ClampedArray): void {
    this.wholeBufferChange = {
      before: new Uint8ClampedArray(before),
      after: new Uint8ClampedArray(after),
    };

    // Clear all other changes (whole buffer overrides everything)
    this.pixelDiffs.clear();
    this.tileFills.clear();
    this.partialBufferChange = undefined;
  }

  /**
   * Check if there are any pending changes
   */
  hasPendingChanges(): boolean {
    return this.wholeBufferChange !== undefined || this.partialBufferChange !== undefined || this.tileFills.size > 0 || this.pixelDiffs.size > 0;
  }

  /**
   * Get count of pending pixel changes
   */
  getPendingPixelCount(): number {
    if (this.wholeBufferChange) {
      return this.wholeBufferChange.after.length / 4;
    }

    let count = 0;

    // Count tile fills (each tile = tileSize² pixels)
    count += this.tileFills.size * (32 * 32); // TODO: get tileSize from somewhere

    // Count individual pixel changes
    for (const tileDiff of this.pixelDiffs.values()) {
      count += tileDiff.changes.size;
    }

    return count;
  }

  /**
   * Get the accumulated changes without clearing them
   */
  getPendingChanges(): {
    wholeBuffer?: { before: Uint8ClampedArray; after: Uint8ClampedArray };
    partialBuffer?: { boundBox: { x: number; y: number; width: number; height: number }; before: Uint8ClampedArray; after: Uint8ClampedArray };
    tileFills: Array<{ tile: TileIndex; before?: number; after: number }>;
    pixelChanges: Array<{
      tile: TileIndex;
      indices: number[];
      beforeValues: number[];
      afterValues: number[];
    }>;
  } {
    const tileFills = Array.from(this.tileFills.values());

    const pixelChanges = Array.from(this.pixelDiffs.values()).map((tileDiff) => {
      const indices: number[] = [];
      const beforeValues: number[] = [];
      const afterValues: number[] = [];

      for (const [index, change] of tileDiff.changes) {
        indices.push(index);
        beforeValues.push(change.before);
        afterValues.push(change.after);
      }

      return {
        tile: tileDiff.tile,
        indices,
        beforeValues,
        afterValues,
      };
    });

    return {
      wholeBuffer: this.wholeBufferChange,
      partialBuffer: this.partialBufferChange && {
        boundBox: this.partialBufferChange.boundBox,
        before: this.partialBufferChange.before,
        after: this.partialBufferChange.after,
      },
      tileFills,
      pixelChanges,
    };
  }

  /**
   * Clear all pending changes
   */
  clear(): void {
    this.wholeBufferChange = undefined;
    this.partialBufferChange = undefined;
    this.tileFills.clear();
    this.pixelDiffs.clear();
  }

  /**
   * Check if a specific pixel has a pending change
   */
  hasPixelChange(tile: TileIndex, tileLocalIndex: number): boolean {
    const tileKey = `${tile.row},${tile.col}`;

    // Tile fill overrides pixel changes
    if (this.tileFills.has(tileKey)) {
      return true;
    }

    const tileDiff = this.pixelDiffs.get(tileKey);
    return tileDiff?.changes.has(tileLocalIndex) ?? false;
  }

  /**
   * Get memory usage estimate in bytes
   */
  getMemoryUsage(): number {
    let bytes = 0;

    // Whole buffer changes
    if (this.wholeBufferChange) {
      bytes += this.wholeBufferChange.before.byteLength;
      bytes += this.wholeBufferChange.after.byteLength;
    }

    // Partial buffer change
    if (this.partialBufferChange) {
      bytes += this.partialBufferChange.before.byteLength;
      bytes += this.partialBufferChange.after.byteLength;
    }

    // Tile fills (approximately 32 bytes per entry)
    bytes += this.tileFills.size * 32;

    // Pixel changes (approximately 16 bytes per pixel + Map overhead)
    for (const tileDiff of this.pixelDiffs.values()) {
      bytes += tileDiff.changes.size * 16;
    }

    return bytes;
  }

  /**
   * Register a partial (rectangular) buffer change. Overrides pixel/tile diffs inside its bounds.
   * Existing pixel/tile diffs are cleared because partial patch replaces them for efficiency.
   */
  addPartialBufferChange(boundBox: { x: number; y: number; width: number; height: number }, before: Uint8ClampedArray, after: Uint8ClampedArray) {
    if (before.length !== after.length) throw new Error('partial buffer before/after length mismatch');
    const expected = boundBox.width * boundBox.height * 4;
    if (before.length !== expected) throw new Error(`partial buffer length ${before.length} does not match bbox area * 4 = ${expected}`);
    this.partialBufferChange = {
      boundBox: { ...boundBox },
      before: new Uint8ClampedArray(before),
      after: new Uint8ClampedArray(after),
    };
    // Clear fine-grained diffs (they are superseded)
    this.pixelDiffs.clear();
    this.tileFills.clear();
  }
}
