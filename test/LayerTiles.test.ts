import { beforeEach, describe, expect, it } from 'vitest';
import { PixelBuffer } from '../src/buffer/PixelBuffer';
import { LayerTiles } from '../src/buffer/tile/LayerTiles';
import { LayerTilesController } from '../src/buffer/tile/LayerTilesController';
import type { RGBA, TileIndex } from '../src/types';

describe('LayerTiles and LayerTilesController', () => {
  let tiles: LayerTiles;
  let buffer: PixelBuffer;
  let controller: LayerTilesController;
  const tileSize = 32;
  const bufferWidth = 128; // 4 tiles wide
  const bufferHeight = 96; // 3 tiles high

  beforeEach(() => {
    buffer = new PixelBuffer(bufferWidth, bufferHeight);
    tiles = new LayerTiles(bufferWidth, bufferHeight, tileSize);
    controller = new LayerTilesController(tiles, buffer);
  });

  describe('LayerTiles Model', () => {
    it('should calculate tile grid correctly', () => {
      expect(tiles.cols).toBe(4); // 128 / 32
      expect(tiles.rows).toBe(3); // 96 / 32
      expect(tiles.totalTiles).toBe(12); // 4 * 3
    });

    it('should initialize with no dirty tiles', () => {
      const stats = tiles.getStats();
      expect(stats.dirtyTiles).toBe(0);
      expect(tiles.getDirtyTileIndices()).toEqual([]);
    });

    it('should manage dirty flags correctly', () => {
      const tileIndex: TileIndex = { row: 1, col: 2 };

      expect(tiles.isDirty(tileIndex)).toBe(false);

      tiles.setDirty(tileIndex, true);
      expect(tiles.isDirty(tileIndex)).toBe(true);

      const dirtyTiles = tiles.getDirtyTileIndices();
      expect(dirtyTiles).toHaveLength(1);
      expect(dirtyTiles[0]).toEqual(tileIndex);
    });

    it('should clear dirty flags', () => {
      tiles.setDirty({ row: 0, col: 0 }, true);
      tiles.setDirty({ row: 1, col: 1 }, true);
      tiles.setDirty({ row: 2, col: 3 }, true);

      let stats = tiles.getStats();
      expect(stats.dirtyTiles).toBe(3);
      expect(tiles.getDirtyTileIndices()).toHaveLength(3);

      tiles.clearAllDirty();

      stats = tiles.getStats();
      expect(stats.dirtyTiles).toBe(0);
      expect(tiles.getDirtyTileIndices()).toEqual([]);
    });

    it('should manage uniform color tiles', () => {
      const tileIndex: TileIndex = { row: 1, col: 1 };
      const color: RGBA = [255, 128, 64, 200];

      expect(tiles.isUniform(tileIndex)).toBe(false);

      tiles.setUniform(tileIndex, true, color);
      expect(tiles.isUniform(tileIndex)).toBe(true);
      expect(tiles.getUniformColor(tileIndex)).toEqual(color);
    });

    it('should handle edge cases for tile indices', () => {
      // Valid edge cases
      expect(tiles.isDirty({ row: 0, col: 0 })).toBe(false);
      expect(tiles.isDirty({ row: 2, col: 3 })).toBe(false);

      // Invalid indices should not crash
      expect(() => tiles.isDirty({ row: -1, col: 0 })).not.toThrow();
      expect(() => tiles.isDirty({ row: 10, col: 0 })).not.toThrow();
      expect(tiles.isDirty({ row: -1, col: 0 })).toBe(false);
      expect(tiles.isDirty({ row: 10, col: 0 })).toBe(false);
    });

    it('should convert pixel coordinates to tile index', () => {
      expect(tiles.pixelToTileIndex(0, 0)).toEqual({ row: 0, col: 0 });
      expect(tiles.pixelToTileIndex(31, 31)).toEqual({ row: 0, col: 0 });
      expect(tiles.pixelToTileIndex(32, 32)).toEqual({ row: 1, col: 1 });
      expect(tiles.pixelToTileIndex(64, 32)).toEqual({ row: 1, col: 2 });
      expect(tiles.pixelToTileIndex(127, 95)).toEqual({ row: 2, col: 3 });
    });
  });

  describe('LayerTilesController', () => {
    it('should get tile bounds correctly', () => {
      const bounds = tiles.getTileBounds({ row: 1, col: 2 });

      expect(bounds.x).toBe(64); // 2 * 32
      expect(bounds.y).toBe(32); // 1 * 32
      expect(bounds.width).toBe(32);
      expect(bounds.height).toBe(32);
    });

    it('should mark tiles dirty when pixels change', () => {
      const color: RGBA = [255, 0, 0, 255];

      // Directly set pixel to verify marking works
      buffer.set(50, 50, color);
      controller.markDirtyByPixel(50, 50);

      const expectedTile = tiles.pixelToTileIndex(50, 50);
      expect(tiles.isDirty(expectedTile)).toBe(true);

      // Verify pixel was actually set
      expect(buffer.get(50, 50)).toEqual(color);
    });

    it('should fill tiles uniformly', () => {
      const tileIndex: TileIndex = { row: 1, col: 1 };
      const fillColor: RGBA = [128, 64, 192, 255];

      controller.fillTile(tileIndex, fillColor);

      // Tile should be marked as uniform
      expect(tiles.isUniform(tileIndex)).toBe(true);
      expect(tiles.getUniformColor(tileIndex)).toEqual(fillColor);
      expect(tiles.isDirty(tileIndex)).toBe(true);

      // Check that pixels in the tile are actually filled
      const bounds = tiles.getTileBounds(tileIndex);
      expect(buffer.get(bounds.x, bounds.y)).toEqual(fillColor);
      expect(buffer.get(bounds.x + 15, bounds.y + 15)).toEqual(fillColor);
    });

    it('should handle partial tiles at edges', () => {
      // Create buffer that doesn't align perfectly with tile size
      const smallBuffer = new PixelBuffer(50, 50); // 1.56 tiles in each dimension
      const smallTiles = new LayerTiles(50, 50, 32);
      const smallController = new LayerTilesController(smallTiles, smallBuffer);

      expect(smallTiles.cols).toBe(2); // ceil(50/32)
      expect(smallTiles.rows).toBe(2); // ceil(50/32)

      // Fill edge tile
      const edgeTile: TileIndex = { row: 1, col: 1 };
      const color: RGBA = [100, 200, 50, 255];
      smallController.fillTile(edgeTile, color);

      // Verify partial tile was filled correctly
      expect(smallBuffer.get(32, 32)).toEqual(color);
      expect(smallBuffer.get(49, 49)).toEqual(color);
    });

    it('should break uniformity when individual pixels change', () => {
      const tileIndex: TileIndex = { row: 0, col: 0 };
      const uniformColor: RGBA = [100, 100, 100, 255];
      const differentColor: RGBA = [200, 50, 150, 255];

      // Fill tile uniformly
      controller.fillTile(tileIndex, uniformColor);
      expect(tiles.isUniform(tileIndex)).toBe(true);

      // Change one pixel and mark dirty manually
      buffer.set(5, 5, differentColor);
      controller.markDirtyByPixel(5, 5);

      // Tile should no longer be uniform
      expect(tiles.isUniform(tileIndex)).toBe(false);
      expect(tiles.isDirty(tileIndex)).toBe(true);
    });

    it('should detect tile uniformity', () => {
      const tileIndex: TileIndex = { row: 0, col: 0 };
      const color: RGBA = [150, 150, 150, 255];

      // Manually fill buffer area
      const bounds = tiles.getTileBounds(tileIndex);
      for (let y = bounds.y; y < bounds.y + bounds.height; y++) {
        for (let x = bounds.x; x < bounds.x + bounds.width; x++) {
          if (buffer.isInBounds(x, y)) {
            buffer.set(x, y, color);
          }
        }
      }

      // Initially not marked as uniform
      expect(tiles.isUniform(tileIndex)).toBe(false);

      // Detect uniformity
      const isUniform = controller.detectTileUniformity(tileIndex);
      expect(isUniform).toBe(true);
      expect(tiles.isUniform(tileIndex)).toBe(true);
      expect(tiles.getUniformColor(tileIndex)).toEqual(color);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle multiple tile operations', () => {
      const redColor: RGBA = [255, 0, 0, 255];
      const blueColor: RGBA = [0, 0, 255, 255];
      const greenColor: RGBA = [0, 255, 0, 255];

      // Fill some tiles
      controller.fillTile({ row: 0, col: 0 }, redColor);
      controller.fillTile({ row: 1, col: 1 }, blueColor);

      // Set individual pixels
      buffer.set(100, 50, greenColor);
      controller.markDirtyByPixel(100, 50);

      const dirtyTiles = tiles.getDirtyTileIndices();
      expect(dirtyTiles.length).toBeGreaterThanOrEqual(3);

      // Verify operations
      expect(tiles.isUniform({ row: 0, col: 0 })).toBe(true);
      expect(tiles.isUniform({ row: 1, col: 1 })).toBe(true);
      expect(buffer.get(100, 50)).toEqual(greenColor);
    });

    it('should efficiently track changes across the buffer', () => {
      // Set pixels in different tiles
      buffer.set(10, 10, [255, 0, 0, 255]); // Tile (0,0)
      controller.markDirtyByPixel(10, 10);

      buffer.set(50, 50, [0, 255, 0, 255]); // Tile (1,1)
      controller.markDirtyByPixel(50, 50);

      buffer.set(100, 80, [0, 0, 255, 255]); // Tile (2,3)
      controller.markDirtyByPixel(100, 80);

      const dirtyTiles = tiles.getDirtyTileIndices();
      expect(dirtyTiles).toHaveLength(3);

      // Verify specific tiles are dirty
      expect(tiles.isDirty({ row: 0, col: 0 })).toBe(true);
      expect(tiles.isDirty({ row: 1, col: 1 })).toBe(true);
      expect(tiles.isDirty({ row: 2, col: 3 })).toBe(true);

      // Clean tiles should not be dirty
      expect(tiles.isDirty({ row: 0, col: 1 })).toBe(false);
      expect(tiles.isDirty({ row: 2, col: 0 })).toBe(false);
    });

    it('should provide useful statistics', () => {
      // Initially clean
      let stats = tiles.getStats();
      expect(stats.totalTiles).toBe(12);
      expect(stats.dirtyTiles).toBe(0);
      expect(stats.uniformTiles).toBe(0);

      // Add some dirty tiles
      controller.fillTile({ row: 0, col: 0 }, [255, 0, 0, 255]);
      controller.fillTile({ row: 1, col: 1 }, [0, 255, 0, 255]);

      stats = tiles.getStats();
      expect(stats.dirtyTiles).toBe(2);
      expect(stats.uniformTiles).toBe(2);
      expect(stats.memoryUsage).toBeGreaterThan(0);
    });
  });
});
