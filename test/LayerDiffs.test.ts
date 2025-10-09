import { beforeEach, describe, expect, it } from 'vitest';
import { PixelBuffer } from '../src/buffer/PixelBuffer';
import { LayerDiffs } from '../src/buffer/diff/LayerDiffs';
import { LayerDiffsController } from '../src/buffer/diff/LayerDiffsController';
import { LayerTiles } from '../src/buffer/tile/LayerTiles';
import { LayerTilesController } from '../src/buffer/tile/LayerTilesController';
import type { RGBA, TileIndex } from '../src/types';

describe('LayerDiffs and LayerDiffsController', () => {
  let diffs: LayerDiffs;
  let buffer: PixelBuffer;
  let tiles: LayerTiles;
  let tilesController: LayerTilesController;
  let diffsController: LayerDiffsController;
  const bufferWidth = 64;
  const bufferHeight = 64;
  const tileSize = 32;

  beforeEach(() => {
    buffer = new PixelBuffer(bufferWidth, bufferHeight);
    tiles = new LayerTiles(bufferWidth, bufferHeight, tileSize);
    tilesController = new LayerTilesController(tiles, buffer);
    diffs = new LayerDiffs();
    diffsController = new LayerDiffsController(diffs, tilesController, tileSize);
  });

  describe('LayerDiffs Model', () => {
    it('should initialize empty', () => {
      expect(diffs.hasPendingChanges()).toBe(false);
      expect(diffs.getPendingPixelCount()).toBe(0);
    });

    it('should accumulate pixel diffs', () => {
      const tileIndex: TileIndex = { row: 0, col: 0 };

      diffs.addPixelChange(tileIndex, 5, [255, 0, 0, 255], [0, 255, 0, 255]);
      diffs.addPixelChange(tileIndex, 10, [0, 0, 255, 255], [255, 255, 0, 255]);

      expect(diffs.hasPendingChanges()).toBe(true);

      const pending = diffs.getPendingChanges();
      expect(pending.pixelChanges).toHaveLength(1);
      expect(pending.pixelChanges[0].indices).toHaveLength(2);
    });

    it('should handle tile fills', () => {
      const tileIndex: TileIndex = { row: 1, col: 1 };
      const newColor: RGBA = [128, 64, 192, 255];
      const oldColor: RGBA = [255, 255, 255, 255];

      diffs.addTileFill(tileIndex, oldColor, newColor);

      expect(diffs.hasPendingChanges()).toBe(true);

      const pending = diffs.getPendingChanges();
      expect(pending.tileFills).toHaveLength(1);
      expect(pending.tileFills[0].tile).toEqual(tileIndex);
    });

    it('should handle whole buffer changes', () => {
      const oldBuffer = new Uint8ClampedArray(bufferWidth * bufferHeight * 4);
      const newBuffer = new Uint8ClampedArray(bufferWidth * bufferHeight * 4);
      oldBuffer.fill(100);
      newBuffer.fill(200);

      diffs.addWholeBufferChange(newBuffer);

      expect(diffs.hasPendingChanges()).toBe(true);

      const pending = diffs.getPendingChanges();
      expect(pending.wholeBuffer).toBeDefined();
      expect(pending.wholeBuffer!.swapBuffer).toEqual(newBuffer);
    });

    it('should clear all changes', () => {
      const tileIndex: TileIndex = { row: 0, col: 0 };

      diffs.addPixelChange(tileIndex, 5, [255, 0, 0, 255], [0, 255, 0, 255]);
      diffs.addTileFill(tileIndex, [128, 64, 192, 255], [255, 255, 255, 255]);

      expect(diffs.hasPendingChanges()).toBe(true);

      diffs.clear();

      expect(diffs.hasPendingChanges()).toBe(false);
      expect(diffs.getPendingPixelCount()).toBe(0);
    });

    it('should handle multiple tiles', () => {
      const tile1: TileIndex = { row: 0, col: 0 };
      const tile2: TileIndex = { row: 0, col: 1 };
      const tile3: TileIndex = { row: 1, col: 0 };

      diffs.addPixelChange(tile1, 5, [255, 0, 0, 255], [0, 0, 0, 0]);
      diffs.addPixelChange(tile2, 10, [0, 255, 0, 255], [0, 0, 0, 0]);
      diffs.addTileFill(tile3, [128, 128, 128, 255], [0, 0, 255, 255]);

      const pending = diffs.getPendingChanges();
      expect(pending.pixelChanges).toHaveLength(2);
      expect(pending.tileFills).toHaveLength(1);

      // Check that changes are properly separated by tile
      expect(pending.pixelChanges[0].tile).toEqual(tile1);
      expect(pending.pixelChanges[1].tile).toEqual(tile2);
      expect(pending.tileFills[0].tile).toEqual(tile3);
    });

    it('should track pixel changes per tile location', () => {
      const tileIndex: TileIndex = { row: 0, col: 0 };

      expect(diffs.hasPixelChange(tileIndex, 5)).toBe(false);

      diffs.addPixelChange(tileIndex, 5, [0, 0, 0, 0], [255, 0, 0, 255]);

      expect(diffs.hasPixelChange(tileIndex, 5)).toBe(true);
      expect(diffs.hasPixelChange(tileIndex, 10)).toBe(false);
    });
  });

  describe('LayerDiffsController', () => {
    it('should record pixel changes by global coordinates', () => {
      const oldColor: RGBA = [0, 0, 0, 0];
      const newColor: RGBA = [255, 128, 64, 200];

      diffsController.addPixel(10, 15, oldColor, newColor);

      expect(diffs.hasPendingChanges()).toBe(true);

      // Verify the change is tracked
      expect(diffsController.hasPixelDiff(10, 15)).toBe(true);
      expect(diffsController.hasPixelDiff(20, 25)).toBe(false);
    });

    it('should record tile fills', () => {
      const tileIndex: TileIndex = { row: 0, col: 1 };
      const oldColor: RGBA = [100, 100, 100, 255];
      const newColor: RGBA = [255, 0, 0, 255];

      diffsController.addTileFill(tileIndex, oldColor, newColor);

      expect(diffs.hasPendingChanges()).toBe(true);

      const pending = diffs.getPendingChanges();
      expect(pending.tileFills).toHaveLength(1);
      expect(pending.tileFills[0].tile).toEqual(tileIndex);
    });

    it('should generate patches correctly', () => {
      const color1: RGBA = [255, 0, 0, 255];
      const color2: RGBA = [0, 255, 0, 255];
      const fillColor: RGBA = [0, 0, 255, 255];

      // Record some changes
      diffsController.addPixel(5, 10, [0, 0, 0, 0], color1);
      diffsController.addPixel(25, 30, [0, 0, 0, 0], color2);
      diffsController.addTileFill({ row: 1, col: 1 }, [128, 128, 128, 255], fillColor);

      const patch = diffsController.previewPatch();

      expect(patch).toBeDefined();
      expect(patch!.pixels).toBeDefined();
      expect(patch!.tiles).toBeDefined();
      expect(patch!.pixels!).toHaveLength(1); // Pixel changes are grouped by tile
      expect(patch!.tiles!).toHaveLength(1);
    });

    it('should flush changes correctly', () => {
      diffsController.addPixel(10, 10, [0, 0, 0, 0], [255, 255, 255, 255]);

      expect(diffs.hasPendingChanges()).toBe(true);

      const patch = diffsController.flush();

      expect(patch).toBeDefined();
      expect(diffs.hasPendingChanges()).toBe(false);
    });

    it('should handle mixed operations efficiently', () => {
      const redColor: RGBA = [255, 0, 0, 255];
      const blueColor: RGBA = [0, 0, 255, 255];
      const greenColor: RGBA = [0, 255, 0, 255];

      // Individual pixel changes in first tile
      diffsController.addPixel(5, 5, [0, 0, 0, 0], redColor);
      diffsController.addPixel(10, 10, [0, 0, 0, 0], redColor);
      diffsController.addPixel(15, 15, [0, 0, 0, 0], redColor);

      // Tile fill operation in second tile
      diffsController.addTileFill({ row: 0, col: 1 }, [128, 128, 128, 255], blueColor);

      // More pixel changes in a different tile
      diffsController.addPixel(35, 35, [0, 0, 0, 0], greenColor);
      diffsController.addPixel(40, 40, [0, 0, 0, 0], greenColor);

      const patch = diffsController.previewPatch();

      expect(patch!.pixels!).toHaveLength(2); // Two tiles with pixel changes
      expect(patch!.tiles!).toHaveLength(1); // One tile fill
      expect(patch!.whole).toBeUndefined();

      // Verify pixel counts
      const tile1Pixels = patch!.pixels!.find((p) => p.tile.row === 0 && p.tile.col === 0);
      const tile2Pixels = patch!.pixels!.find((p) => p.tile.row === 1 && p.tile.col === 1);

      expect(tile1Pixels?.idx.length).toBe(3); // 3 pixel changes in tile (0,0)
      expect(tile2Pixels?.idx.length).toBe(2); // 2 pixel changes in tile (1,1)
    });

    it('should handle whole buffer changes', () => {
      const bufferSize = bufferWidth * bufferHeight * 4;
      const oldBufferData = new Uint8ClampedArray(bufferSize);
      const newBufferData = new Uint8ClampedArray(bufferSize);
      oldBufferData.fill(128);
      newBufferData.fill(255);

      diffsController.addWholeBufferChange(newBufferData);

      expect(diffs.hasPendingChanges()).toBe(true);

      const patch = diffsController.previewPatch();
      expect(patch!.whole).toBeDefined();
      expect(patch!.pixels).toBeUndefined();
      expect(patch!.tiles).toBeUndefined();
    });

    it('should provide useful debugging information', () => {
      // Initially clean
      let debugInfo = diffsController.getDebugInfo();
      expect(debugInfo.hasPending).toBe(false);
      expect(debugInfo.pendingPixels).toBe(0);
      expect(debugInfo.hasWhole).toBe(false);

      // Add some changes
      diffsController.addPixel(10, 10, [0, 0, 0, 0], [255, 0, 0, 255]);
      diffsController.addTileFill({ row: 1, col: 1 }, [128, 128, 128, 255], [0, 255, 0, 255]);

      debugInfo = diffsController.getDebugInfo();
      expect(debugInfo.hasPending).toBe(true);
      expect(debugInfo.pendingPixels).toBeGreaterThan(0);
      expect(debugInfo.tileCount).toBe(1);
      expect(debugInfo.pixelTileCount).toBe(1);
      expect(debugInfo.memoryUsage).toBeGreaterThan(0);
    });
  });

  describe('Integration scenarios', () => {
    it('should track complex editing session', () => {
      // Phase 1: Draw some pixels
      for (let i = 0; i < 10; i++) {
        diffsController.addPixel(i * 3, i * 2, [0, 0, 0, 0], [i * 25, 255 - i * 25, 128, 255]);
      }

      // Phase 2: Fill a tile
      diffsController.addTileFill({ row: 1, col: 0 }, [64, 64, 64, 255], [255, 128, 0, 255]);

      // Phase 3: More pixel edits in second tile row
      for (let i = 0; i < 5; i++) {
        diffsController.addPixel(40 + i, 40 + i, [255, 128, 0, 255], [0, 0, 255, 255]);
      }

      expect(diffs.hasPendingChanges()).toBe(true);
      expect(diffsController.getPendingPixelCount()).toBeGreaterThan(1000); // Tile fill adds many pixels

      const patch = diffsController.flush();

      expect(patch).toBeDefined();
      expect(patch!.pixels).toBeDefined();
      expect(patch!.tiles).toBeDefined();

      // After flush, diffs should be clean
      expect(diffs.hasPendingChanges()).toBe(false);
    });

    it('should handle edge case coordinates', () => {
      // Test pixels at tile boundaries
      const edgeCoords = [
        [0, 0], // Top-left of first tile
        [31, 31], // Bottom-right of first tile
        [32, 32], // Top-left of second tile
        [63, 63], // Bottom-right of last tile
      ];

      edgeCoords.forEach(([x, y], index) => {
        diffsController.addPixel(x, y, [0, 0, 0, 0], [index * 60, index * 60, index * 60, 255]);
      });

      expect(diffs.hasPendingChanges()).toBe(true);

      const patch = diffsController.previewPatch();
      expect(patch!.pixels).toBeDefined();

      // Verify all edge pixels are tracked
      edgeCoords.forEach(([x, y]) => {
        expect(diffsController.hasPixelDiff(x, y)).toBe(true);
      });
    });

    it('should discard pending changes when requested', () => {
      diffsController.addPixel(10, 10, [0, 0, 0, 0], [255, 0, 0, 255]);
      diffsController.addTileFill({ row: 1, col: 1 }, [128, 128, 128, 255], [0, 255, 0, 255]);

      expect(diffs.hasPendingChanges()).toBe(true);

      diffsController.discardPendingChanges();

      expect(diffs.hasPendingChanges()).toBe(false);
      expect(diffsController.getPendingPixelCount()).toBe(0);
    });

    it('should handle tile fill overriding pixel changes', () => {
      const tileIndex: TileIndex = { row: 0, col: 0 };

      // First add pixel changes
      diffsController.addPixel(5, 5, [0, 0, 0, 0], [255, 0, 0, 255]);
      diffsController.addPixel(10, 10, [0, 0, 0, 0], [0, 255, 0, 255]);

      let pending = diffs.getPendingChanges();
      expect(pending.pixelChanges).toHaveLength(1);
      expect(pending.tileFills).toHaveLength(0);

      // Then add tile fill - should override pixel changes for that tile
      diffsController.addTileFill(tileIndex, [64, 64, 64, 255], [0, 0, 255, 255]);

      pending = diffs.getPendingChanges();
      expect(pending.pixelChanges).toHaveLength(0); // Pixel changes should be cleared
      expect(pending.tileFills).toHaveLength(1);
    });
  });
});
