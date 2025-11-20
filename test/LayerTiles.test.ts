import { beforeEach, describe, expect, it } from 'vitest';
import { RgbaBuffer } from '../src/buffer/RgbaBuffer';
import { TilesController } from '../src/buffer/TilesController';
import type { TileIndex } from '../src/types/types';
import type { RGBA } from '../src/models/RGBA';

describe('TilesController', () => {
  let buffer: RgbaBuffer;
  let controller: TilesController;
  const tileSize = 32;
  const bufferWidth = 128; // 4 tiles wide
  const bufferHeight = 96; // 3 tiles high

  beforeEach(() => {
    buffer = new RgbaBuffer(bufferWidth, bufferHeight);
    controller = new TilesController(buffer, bufferWidth, bufferHeight, tileSize);
  });

  describe('TilesController Model', () => {
    it('should calculate tile grid correctly', () => {
      expect(controller.getCols()).toBe(4); // 128 / 32
      expect(controller.getRows()).toBe(3); // 96 / 32
      expect(controller.totalTiles).toBe(12); // 4 * 3
    });

    it('should initialize with no dirty tiles', () => {
      const stats = controller.getStats();
      expect(stats.dirtyTiles).toBe(0);
      expect(controller.getDirtyTileIndices()).toEqual([]);
    });

    it('should manage dirty flags correctly', () => {
      const tileIndex: TileIndex = { row: 1, col: 2 };

      expect(controller.isDirty(tileIndex)).toBe(false);

      controller.setDirty(tileIndex, true);
      expect(controller.isDirty(tileIndex)).toBe(true);

      const dirtyTiles = controller.getDirtyTileIndices();
      expect(dirtyTiles).toHaveLength(1);
      expect(dirtyTiles[0]).toEqual(tileIndex);
    });

    it('should clear dirty flags', () => {
      controller.setDirty({ row: 0, col: 0 }, true);
      controller.setDirty({ row: 1, col: 1 }, true);
      controller.setDirty({ row: 2, col: 3 }, true);

      let stats = controller.getStats();
      expect(stats.dirtyTiles).toBe(3);
      expect(controller.getDirtyTileIndices()).toHaveLength(3);

      controller.clearAllDirty();

      stats = controller.getStats();
      expect(stats.dirtyTiles).toBe(0);
      expect(controller.getDirtyTileIndices()).toEqual([]);
    });

    it('should manage uniform color tiles', () => {
      const tileIndex: TileIndex = { row: 1, col: 1 };
      const color: RGBA = [255, 128, 64, 200];

      expect(controller.isUniform(tileIndex)).toBe(false);

      controller.setUniform(tileIndex, true, color);
      expect(controller.isUniform(tileIndex)).toBe(true);
      expect(controller.getUniformColor(tileIndex)).toEqual(color);
    });

    it('should handle edge cases for tile indices', () => {
      // Valid edge cases
      expect(controller.isDirty({ row: 0, col: 0 })).toBe(false);
      expect(controller.isDirty({ row: 2, col: 3 })).toBe(false);

      // Invalid indices should not crash
      expect(() => controller.isDirty({ row: -1, col: 0 })).not.toThrow();
      expect(() => controller.isDirty({ row: 10, col: 0 })).not.toThrow();
      expect(controller.isDirty({ row: -1, col: 0 })).toBe(false);
      expect(controller.isDirty({ row: 10, col: 0 })).toBe(false);
    });

    it('should convert pixel coordinates to tile index', () => {
      expect(controller.pixelToTileIndex(0, 0)).toEqual({ row: 0, col: 0 });
      expect(controller.pixelToTileIndex(31, 31)).toEqual({ row: 0, col: 0 });
      expect(controller.pixelToTileIndex(32, 32)).toEqual({ row: 1, col: 1 });
      expect(controller.pixelToTileIndex(64, 32)).toEqual({ row: 1, col: 2 });
      expect(controller.pixelToTileIndex(127, 95)).toEqual({ row: 2, col: 3 });
    });
  });

  describe('TilesController Operations', () => {
    it('should get tile bounds correctly', () => {
      const bounds = controller.getTileBounds({ row: 1, col: 2 });

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

      const expectedTile = controller.pixelToTileIndex(50, 50);
      expect(controller.isDirty(expectedTile)).toBe(true);

      // Verify pixel was actually set
      expect(buffer.get(50, 50)).toEqual(color);
    });

    it('should fill tiles uniformly', () => {
      const tileIndex: TileIndex = { row: 1, col: 1 };
      const fillColor: RGBA = [128, 64, 192, 255];

      controller.fillTile(tileIndex, fillColor);

      // Tile should be marked as uniform
      expect(controller.isUniform(tileIndex)).toBe(true);
      expect(controller.getUniformColor(tileIndex)).toEqual(fillColor);
      expect(controller.isDirty(tileIndex)).toBe(true);

      // Check that pixels in the tile are actually filled
      const bounds = controller.getTileBounds(tileIndex);
      expect(buffer.get(bounds.x, bounds.y)).toEqual(fillColor);
      expect(buffer.get(bounds.x + 15, bounds.y + 15)).toEqual(fillColor);
    });

    it('should handle partial tiles at edges', () => {
      // Create buffer that doesn't align perfectly with tile size
      const smallBuffer = new RgbaBuffer(50, 50); // 1.56 tiles in each dimension
      const smallController = new TilesController(smallBuffer, 50, 50, 32);

      expect(smallController.getCols()).toBe(2); // ceil(50/32)
      expect(smallController.getRows()).toBe(2); // ceil(50/32)

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
      expect(controller.isUniform(tileIndex)).toBe(true);

      // Change one pixel and mark dirty manually
      buffer.set(5, 5, differentColor);
      controller.markDirtyByPixel(5, 5);

      // Tile should no longer be uniform
      expect(controller.isUniform(tileIndex)).toBe(false);
      expect(controller.isDirty(tileIndex)).toBe(true);
    });

    it('should detect tile uniformity', () => {
      const tileIndex: TileIndex = { row: 0, col: 0 };
      const color: RGBA = [150, 150, 150, 255];

      // Manually fill buffer area
      const bounds = controller.getTileBounds(tileIndex);
      for (let y = bounds.y; y < bounds.y + bounds.height; y++) {
        for (let x = bounds.x; x < bounds.x + bounds.width; x++) {
          if (buffer.isInBounds(x, y)) {
            buffer.set(x, y, color);
          }
        }
      }

      // Initially not marked as uniform
      expect(controller.isUniform(tileIndex)).toBe(false);

      // Detect uniformity
      const isUniform = controller.detectTileUniformity(tileIndex);
      expect(isUniform).toBe(true);
      expect(controller.isUniform(tileIndex)).toBe(true);
      expect(controller.getUniformColor(tileIndex)).toEqual(color);
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

      const dirtyTiles = controller.getDirtyTileIndices();
      expect(dirtyTiles.length).toBeGreaterThanOrEqual(3);

      // Verify operations
      expect(controller.isUniform({ row: 0, col: 0 })).toBe(true);
      expect(controller.isUniform({ row: 1, col: 1 })).toBe(true);
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

      const dirtyTiles = controller.getDirtyTileIndices();
      expect(dirtyTiles).toHaveLength(3);

      // Verify specific tiles are dirty
      expect(controller.isDirty({ row: 0, col: 0 })).toBe(true);
      expect(controller.isDirty({ row: 1, col: 1 })).toBe(true);
      expect(controller.isDirty({ row: 2, col: 3 })).toBe(true);

      // Clean tiles should not be dirty
      expect(controller.isDirty({ row: 0, col: 1 })).toBe(false);
      expect(controller.isDirty({ row: 2, col: 0 })).toBe(false);
    });

    it('should provide useful statistics', () => {
      // Initially clean
      let stats = controller.getStats();
      expect(stats.totalTiles).toBe(12);
      expect(stats.dirtyTiles).toBe(0);
      expect(stats.uniformTiles).toBe(0);

      // Add some dirty tiles
      controller.fillTile({ row: 0, col: 0 }, [255, 0, 0, 255]);
      controller.fillTile({ row: 1, col: 1 }, [0, 255, 0, 255]);

      stats = controller.getStats();
      expect(stats.dirtyTiles).toBe(2);
      expect(stats.uniformTiles).toBe(2);
      expect(stats.memoryUsage).toBeGreaterThan(0);
    });

    it('should handle tile resize operations', () => {
      // Set up some state
      controller.setDirty({ row: 0, col: 0 }, true);
      controller.fillTile({ row: 1, col: 1 }, [255, 0, 0, 255]);

      expect(controller.isDirty({ row: 0, col: 0 })).toBe(true);
      expect(controller.isUniform({ row: 1, col: 1 })).toBe(true);

      // Resize to a larger size
      const newWidth = 160; // 5 tiles wide
      const newHeight = 128; // 4 tiles high
      controller.resize(newWidth, newHeight);

      expect(controller.getCols()).toBe(5);
      expect(controller.getRows()).toBe(4);

      // Note: resize creates new tile grid, so previous state may not be preserved
      // This is expected behavior for the current implementation
    });

    it('should validate all tile uniformity', () => {
      // Manually fill some tiles with uniform colors in the buffer
      const tileIndex1: TileIndex = { row: 0, col: 0 };
      const tileIndex2: TileIndex = { row: 0, col: 1 };
      const color1: RGBA = [255, 0, 0, 255];
      const color2: RGBA = [0, 255, 0, 255];

      // Fill tile areas manually in buffer
      const bounds1 = controller.getTileBounds(tileIndex1);
      const bounds2 = controller.getTileBounds(tileIndex2);

      for (let y = bounds1.y; y < bounds1.y + bounds1.height; y++) {
        for (let x = bounds1.x; x < bounds1.x + bounds1.width; x++) {
          buffer.set(x, y, color1);
        }
      }

      for (let y = bounds2.y; y < bounds2.y + bounds2.height; y++) {
        for (let x = bounds2.x; x < bounds2.x + bounds2.width; x++) {
          buffer.set(x, y, color2);
        }
      }

      // Initially not marked as uniform
      expect(controller.isUniform(tileIndex1)).toBe(false);
      expect(controller.isUniform(tileIndex2)).toBe(false);

      // Validate all tile uniformity
      controller.validateAllTileUniformity();

      // Now should be marked as uniform
      expect(controller.isUniform(tileIndex1)).toBe(true);
      expect(controller.isUniform(tileIndex2)).toBe(true);
      expect(controller.getUniformColor(tileIndex1)).toEqual(color1);
      expect(controller.getUniformColor(tileIndex2)).toEqual(color2);
    });
  });
});
