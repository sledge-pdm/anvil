import { beforeEach, describe, expect, it } from 'vitest';
import { TilesController } from '../../../src/buffer/TilesController';
import type { RGBA } from '../../../src/models/RGBA';
import type { TileIndex } from '../../../src/types/types';
import { RgbaBuffer } from '../../../src/wasm/pkg/anvil_wasm';
import { BLUE, GREEN, RED } from '../../support/colors';

describe('TilesController', () => {
  let buffer: RgbaBuffer;
  let controller: TilesController;
  const TILE_SIZE = 32;
  const BUFFER_WIDTH = 128; // 4 tiles wide
  const BUFFER_HEIGHT = 96; // 3 tiles high

  beforeEach(() => {
    buffer = new RgbaBuffer(BUFFER_WIDTH, BUFFER_HEIGHT);
    controller = new TilesController(buffer, BUFFER_WIDTH, BUFFER_HEIGHT, TILE_SIZE);
  });

  describe('TilesController Model', () => {
    it('should calculate tile grid correctly', () => {
      expect(controller.getCols()).toBe(4); // 128 / 32
      expect(controller.getRows()).toBe(3); // 96 / 32
      expect(controller.totalTiles).toBe(12); // 4 * 3
    });

    it('should initialize with no dirty tiles', () => {
      expect(controller.getDirtyTiles().length).toBe(0);
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

      expect(controller.getDirtyTiles().length).toBe(3);
      expect(controller.getDirtyTileIndices()).toHaveLength(3);

      controller.clearAllDirty();

      expect(controller.getDirtyTiles().length).toBe(0);
      expect(controller.getDirtyTileIndices()).toEqual([]);
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
      const color: RGBA = RED;

      // Directly set pixel to verify marking works
      buffer.set(50, 50, ...color);
      controller.markDirtyByPixel(50, 50);

      const expectedTile = controller.pixelToTileIndex(50, 50);
      expect(controller.isDirty(expectedTile)).toBe(true);

      // Verify pixel was actually set
      const pc = buffer.get(50, 50);
      expect([pc[0], pc[1], pc[2], pc[3]]).toEqual(color);
    });

    it('should efficiently track changes across the buffer', () => {
      // Set pixels in different tiles
      buffer.set(10, 10, ...RED); // Tile (0,0)
      controller.markDirtyByPixel(10, 10);

      buffer.set(50, 50, ...GREEN); // Tile (1,1)
      controller.markDirtyByPixel(50, 50);

      buffer.set(100, 80, ...BLUE); // Tile (2,3)
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
  });
});
