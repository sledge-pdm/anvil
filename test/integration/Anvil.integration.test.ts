import { beforeEach, describe, expect, it } from 'vitest';
import { Anvil } from '../../src/Anvil';
import type { RGBA } from '../../src/models/RGBA';
import { TileIndex } from '../../src/types/types';
import { BLACK, BLUE, GREEN, RED, semiTransparent, TRANSPARENT, WHITE, YELLOW } from '../support/colors';

describe('Anvil Facade Integration', () => {
  let anvil: Anvil;
  const WIDTH = 128;
  const HEIGHT = 96;
  const TILE_SIZE = 32;

  beforeEach(() => {
    anvil = new Anvil(WIDTH, HEIGHT, TILE_SIZE);
  });

  describe('Initialization', () => {
    it('should create anvil with correct dimensions', () => {
      expect(anvil.getWidth()).toBe(WIDTH);
      expect(anvil.getHeight()).toBe(HEIGHT);
      expect(anvil.getTileSize()).toBe(TILE_SIZE);
    });

    it('should initialize with transparent pixels', () => {
      const blackPixel = anvil.getPixel(0, 0);
      expect(blackPixel).toEqual(TRANSPARENT);

      const centerPixel = anvil.getPixel(WIDTH / 2, HEIGHT / 2);
      expect(centerPixel).toEqual(TRANSPARENT);
    });

    it('should have correct tile grid dimensions', () => {
      const tileInfo = anvil.getTileInfo();
      expect(tileInfo.tilesWide).toBe(Math.ceil(WIDTH / TILE_SIZE));
      expect(tileInfo.tilesHigh).toBe(Math.ceil(HEIGHT / TILE_SIZE));
      expect(tileInfo.totalTiles).toBe(tileInfo.tilesWide * tileInfo.tilesHigh);
    });

    it('should start with no pending changes', () => {
      expect(anvil.hasPendingChanges()).toBe(false);
    });
  });

  describe('Pixel Operations', () => {
    it('should set and get individual pixels', () => {
      anvil.setPixel(10, 15, RED);
      anvil.setPixel(50, 60, semiTransparent(BLUE));

      expect(anvil.getPixel(10, 15)).toEqual(RED);
      expect(anvil.getPixel(50, 60)).toEqual(semiTransparent(BLUE));

      // Verify other pixels remain transparent
      expect(anvil.getPixel(20, 25)).toEqual(TRANSPARENT);
    });

    it('should handle bounds checking for pixels', () => {
      const color: RGBA = [100, 100, 100, 255];

      // Valid coordinates
      expect(() => anvil.setPixel(0, 0, color)).not.toThrow();
      expect(() => anvil.setPixel(WIDTH - 1, HEIGHT - 1, color)).not.toThrow();

      // Out of bounds coordinates
      expect(() => anvil.setPixel(-1, 0, color)).toThrow();
      expect(() => anvil.setPixel(0, -1, color)).toThrow();
      expect(() => anvil.setPixel(WIDTH, 0, color)).toThrow();
      expect(() => anvil.setPixel(0, HEIGHT, color)).toThrow();

      // Similar for getPixel
      expect(() => anvil.getPixel(-1, 0)).toThrow();
      expect(() => anvil.getPixel(WIDTH, HEIGHT)).toThrow();
    });
  });

  describe('Change Tracking', () => {
    it('should track individual pixel changes', () => {
      expect(anvil.hasPendingChanges()).toBe(false);

      anvil.setPixel(25, 30, YELLOW);

      expect(anvil.hasPendingChanges()).toBe(true);
    });

    it('should generate patches for changes', () => {
      // Make some pixel changes
      anvil.setPixel(5, 5, RED);
      anvil.setPixel(10, 10, RED);

      const patch = anvil.previewPatch();

      expect(patch).toBeDefined();
      expect(patch!.pixels).toBeDefined();

      // Ensure patch reflects our changes
      expect(patch!.pixels!.length).toBeGreaterThan(0);
    });

    it('should flush changes and clear state', () => {
      anvil.setPixel(40, 40, semiTransparent(BLACK));

      expect(anvil.hasPendingChanges()).toBe(true);

      const patch = anvil.flushDiffs();

      expect(patch).toBeDefined();
      expect(anvil.hasPendingChanges()).toBe(false);
    });
  });

  describe('Buffer Management', () => {
    it('should provide access to raw buffer data', () => {
      const bufferData = anvil.getBufferPointer();

      expect(bufferData).toBeInstanceOf(Uint8ClampedArray);
      expect(bufferData.length).toBe(WIDTH * HEIGHT * 4);

      // Initially should be all zeros (transparent)
      expect(bufferData.every((value: number) => value === 0)).toBe(true);
    });

    it('should update buffer data when pixels change', () => {
      const color: RGBA = semiTransparent(BLACK);

      anvil.setPixel(10, 10, color);

      const bufferData = anvil.getBufferPointer();
      const pixelIndex = (10 * WIDTH + 10) * 4;

      expect(bufferData[pixelIndex]).toBe(color[0]); // R
      expect(bufferData[pixelIndex + 1]).toBe(color[1]); // G
      expect(bufferData[pixelIndex + 2]).toBe(color[2]); // B
      expect(bufferData[pixelIndex + 3]).toBe(color[3]); // A
    });

    it('should handle buffer resize operations', () => {
      const newWidth = 256;
      const newHeight = 192;

      // Set some initial data
      anvil.setPixel(50, 50, RED);

      anvil.resize(newWidth, newHeight);

      expect(anvil.getWidth()).toBe(newWidth);
      expect(anvil.getHeight()).toBe(newHeight);

      // Data within original bounds should be preserved
      expect(anvil.getPixel(50, 50)).toEqual(RED);

      // New areas should be transparent
      expect(anvil.getPixel(200, 150)).toEqual(TRANSPARENT);
    });

    it('should handle resize with offset preservation', () => {
      anvil.setPixel(10, 10, GREEN);

      // Resize with offset (simulate moving canvas origin)
      anvil.resizeWithOffset(
        { width: WIDTH * 2, height: HEIGHT * 2 },
        {
          destOrigin: { x: 50, y: 50 },
        }
      );

      expect(anvil.getWidth()).toBe(WIDTH * 2);
      expect(anvil.getHeight()).toBe(HEIGHT * 2);

      // Original pixel should be at new location
      expect(anvil.getPixel(10 + 50, 10 + 50)).toEqual(GREEN);

      // Original location should be transparent
      expect(anvil.getPixel(10, 10)).toEqual(TRANSPARENT);
    });
  });

  describe('Tile Management', () => {
    it('should track dirty tiles after changes', () => {
      // Initially no dirty tiles
      expect(anvil.getDirtyTiles()).toHaveLength(0);

      // Make a change in first tile
      anvil.setPixel(15, 15, WHITE);

      const dirtyTiles = anvil.getDirtyTiles();
      expect(dirtyTiles).toHaveLength(1);
      expect(dirtyTiles[0]).toEqual({ row: 0, col: 0 });
    });

    it('should track multiple dirty tiles', () => {
      // Make changes in different tiles
      anvil.setPixel(10, 10, RED); // Tile (0,0)
      anvil.setPixel(50, 10, GREEN); // Tile (0,1)
      anvil.setPixel(10, 50, BLUE); // Tile (1,0)

      const dirtyTiles = anvil.getDirtyTiles();
      expect(dirtyTiles).toHaveLength(3);

      // Check that all expected tiles are marked dirty
      const tileSet = new Set(dirtyTiles.map((t: TileIndex) => `${t.row},${t.col}`));
      expect(tileSet.has('0,0')).toBe(true);
      expect(tileSet.has('0,1')).toBe(true);
      expect(tileSet.has('1,0')).toBe(true);
    });

    it('should clear dirty tiles after flush', () => {
      anvil.setPixel(20, 20, [128, 128, 128, 255]);

      expect(anvil.getDirtyTiles()).toHaveLength(1);

      anvil.clearDirtyTiles();

      expect(anvil.getDirtyTiles()).toHaveLength(0);
    });
  });

  describe('Performance and Memory', () => {
    it('should handle large batch operations efficiently', () => {
      const startTime = performance.now();
      const uniquePositions = new Set<string>();

      // Perform many pixel operations
      for (let i = 0; i < 1000; i++) {
        const x = Math.floor(Math.random() * WIDTH);
        const y = Math.floor(Math.random() * HEIGHT);
        const color: RGBA = [Math.floor(Math.random() * 256), Math.floor(Math.random() * 256), Math.floor(Math.random() * 256), 255];

        // Track unique positions
        uniquePositions.add(`${x},${y}`);
        anvil.setPixel(x, y, color);
      }

      const elapsed = performance.now() - startTime;

      // Should complete within reasonable time (adjust threshold as needed)
      expect(elapsed).toBeLessThan(100); // 100ms for 1000 operations
      expect(anvil.hasPendingChanges()).toBe(true);
    });

    it('should optimize repeated operations on same pixel', () => {
      const finalColor: RGBA = [200, 100, 50, 255];

      // Make multiple changes to the same pixel
      anvil.setPixel(25, 25, RED);
      anvil.setPixel(25, 25, GREEN);
      anvil.setPixel(25, 25, BLUE);
      anvil.setPixel(25, 25, finalColor);

      // Final result should be the last color set
      expect(anvil.getPixel(25, 25)).toEqual(finalColor);

      // Internal diff tracking may optimize this to single change
      expect(anvil.hasPendingChanges()).toBe(true);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle extreme coordinates gracefully', () => {
      const validColor: RGBA = [128, 128, 128, 255];

      // Test boundary conditions
      expect(() => anvil.setPixel(0, 0, validColor)).not.toThrow();
      expect(() => anvil.setPixel(WIDTH - 1, HEIGHT - 1, validColor)).not.toThrow();

      // Test just outside bounds
      expect(() => anvil.setPixel(-1, 0, validColor)).toThrow();
      expect(() => anvil.setPixel(WIDTH, 0, validColor)).toThrow();
      expect(() => anvil.setPixel(0, -1, validColor)).toThrow();
      expect(() => anvil.setPixel(0, HEIGHT, validColor)).toThrow();
    });

    it('should handle invalid colors gracefully', () => {
      // These should be clamped to valid ranges
      const clampedColor: RGBA = [300, -50, 256, 300]; // Out of 0-255 range

      expect(() => anvil.setPixel(10, 10, clampedColor)).not.toThrow();

      const resultColor = anvil.getPixel(10, 10);
      expect(resultColor[0]).toBeGreaterThanOrEqual(0);
      expect(resultColor[0]).toBeLessThanOrEqual(255);
      expect(resultColor[1]).toBeGreaterThanOrEqual(0);
      expect(resultColor[1]).toBeLessThanOrEqual(255);
      expect(resultColor[2]).toBeGreaterThanOrEqual(0);
      expect(resultColor[2]).toBeLessThanOrEqual(255);
      expect(resultColor[3]).toBeGreaterThanOrEqual(0);
      expect(resultColor[3]).toBeLessThanOrEqual(255);
    });

    it('should handle resize to very small dimensions', () => {
      anvil.resize(1, 1);

      expect(anvil.getWidth()).toBe(1);
      expect(anvil.getHeight()).toBe(1);

      expect(() => anvil.setPixel(0, 0, RED)).not.toThrow();
      expect(() => anvil.setPixel(1, 0, RED)).toThrow();
      expect(() => anvil.setPixel(0, 1, RED)).toThrow();
    });
  });
});
