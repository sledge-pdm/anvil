import { beforeEach, describe, expect, it } from 'vitest';
import { Anvil } from '../src/Anvil';
import type { RGBA } from '../src/models/RGBA';
import { TileIndex } from '../src/types/types';

describe('Anvil Facade Integration', () => {
  let anvil: Anvil;
  const width = 128;
  const height = 96;
  const tileSize = 32;

  beforeEach(() => {
    anvil = new Anvil(width, height, tileSize);
  });

  describe('Initialization', () => {
    it('should create anvil with correct dimensions', () => {
      expect(anvil.getWidth()).toBe(width);
      expect(anvil.getHeight()).toBe(height);
      expect(anvil.getTileSize()).toBe(tileSize);
    });

    it('should initialize with transparent pixels', () => {
      const blackPixel = anvil.getPixel(0, 0);
      expect(blackPixel).toEqual([0, 0, 0, 0]);

      const centerPixel = anvil.getPixel(width / 2, height / 2);
      expect(centerPixel).toEqual([0, 0, 0, 0]);
    });

    it('should have correct tile grid dimensions', () => {
      const tileInfo = anvil.getTileInfo();
      expect(tileInfo.tilesWide).toBe(Math.ceil(width / tileSize));
      expect(tileInfo.tilesHigh).toBe(Math.ceil(height / tileSize));
      expect(tileInfo.totalTiles).toBe(tileInfo.tilesWide * tileInfo.tilesHigh);
    });

    it('should start with no pending changes', () => {
      expect(anvil.hasPendingChanges()).toBe(false);
    });
  });

  describe('Pixel Operations', () => {
    it('should set and get individual pixels', () => {
      const redColor: RGBA = [255, 0, 0, 255];
      const blueColor: RGBA = [0, 0, 255, 128];

      anvil.setPixel(10, 15, redColor);
      anvil.setPixel(50, 60, blueColor);

      expect(anvil.getPixel(10, 15)).toEqual(redColor);
      expect(anvil.getPixel(50, 60)).toEqual(blueColor);

      // Verify other pixels remain transparent
      expect(anvil.getPixel(20, 25)).toEqual([0, 0, 0, 0]);
    });

    it('should handle bounds checking for pixels', () => {
      const color: RGBA = [100, 100, 100, 255];

      // Valid coordinates
      expect(() => anvil.setPixel(0, 0, color)).not.toThrow();
      expect(() => anvil.setPixel(width - 1, height - 1, color)).not.toThrow();

      // Out of bounds coordinates
      expect(() => anvil.setPixel(-1, 0, color)).toThrow();
      expect(() => anvil.setPixel(0, -1, color)).toThrow();
      expect(() => anvil.setPixel(width, 0, color)).toThrow();
      expect(() => anvil.setPixel(0, height, color)).toThrow();

      // Similar for getPixel
      expect(() => anvil.getPixel(-1, 0)).toThrow();
      expect(() => anvil.getPixel(width, height)).toThrow();
    });
  });

  describe('Change Tracking', () => {
    it('should track individual pixel changes', () => {
      expect(anvil.hasPendingChanges()).toBe(false);

      anvil.setPixel(25, 30, [255, 255, 0, 255]);

      expect(anvil.hasPendingChanges()).toBe(true);
    });

    it('should generate patches for changes', () => {
      const redColor: RGBA = [255, 0, 0, 255];
      const blueColor: RGBA = [0, 0, 255, 255];

      // Make some pixel changes
      anvil.setPixel(5, 5, redColor);
      anvil.setPixel(10, 10, redColor);

      const patch = anvil.previewPatch();

      expect(patch).toBeDefined();
      expect(patch!.pixels).toBeDefined();

      // Ensure patch reflects our changes
      expect(patch!.pixels!.length).toBeGreaterThan(0);
    });

    it('should flush changes and clear state', () => {
      anvil.setPixel(40, 40, [100, 200, 50, 255]);

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
      expect(bufferData.length).toBe(width * height * 4);

      // Initially should be all zeros (transparent)
      expect(bufferData.every((value: number) => value === 0)).toBe(true);
    });

    it('should update buffer data when pixels change', () => {
      const color: RGBA = [255, 128, 64, 200];

      anvil.setPixel(10, 10, color);

      const bufferData = anvil.getBufferPointer();
      const pixelIndex = (10 * width + 10) * 4;

      expect(bufferData[pixelIndex]).toBe(color[0]); // R
      expect(bufferData[pixelIndex + 1]).toBe(color[1]); // G
      expect(bufferData[pixelIndex + 2]).toBe(color[2]); // B
      expect(bufferData[pixelIndex + 3]).toBe(color[3]); // A
    });

    it('should handle buffer resize operations', () => {
      const newWidth = 256;
      const newHeight = 192;

      // Set some initial data
      anvil.setPixel(50, 50, [255, 0, 0, 255]);

      anvil.resize(newWidth, newHeight);

      expect(anvil.getWidth()).toBe(newWidth);
      expect(anvil.getHeight()).toBe(newHeight);

      // Data within original bounds should be preserved
      expect(anvil.getPixel(50, 50)).toEqual([255, 0, 0, 255]);

      // New areas should be transparent
      expect(anvil.getPixel(200, 150)).toEqual([0, 0, 0, 0]);
    });

    it('should handle resize with offset preservation', () => {
      const originalColor: RGBA = [0, 255, 0, 255];
      anvil.setPixel(10, 10, originalColor);

      // Resize with offset (simulate moving canvas origin)
      anvil.resizeWithOffset(
        { width: width * 2, height: height * 2 },
        {
          destOrigin: { x: 50, y: 50 },
        }
      );

      expect(anvil.getWidth()).toBe(width * 2);
      expect(anvil.getHeight()).toBe(height * 2);

      // Original pixel should be at new location
      expect(anvil.getPixel(10 + 50, 10 + 50)).toEqual(originalColor);

      // Original location should be transparent
      expect(anvil.getPixel(10, 10)).toEqual([0, 0, 0, 0]);
    });
  });

  describe('Tile Management', () => {
    it('should track dirty tiles after changes', () => {
      // Initially no dirty tiles
      expect(anvil.getDirtyTileIndices()).toHaveLength(0);

      // Make a change in first tile
      anvil.setPixel(15, 15, [255, 255, 255, 255]);

      const dirtyTiles = anvil.getDirtyTileIndices();
      expect(dirtyTiles).toHaveLength(1);
      expect(dirtyTiles[0]).toEqual({ row: 0, col: 0 });
    });

    it('should track multiple dirty tiles', () => {
      // Make changes in different tiles
      anvil.setPixel(10, 10, [255, 0, 0, 255]); // Tile (0,0)
      anvil.setPixel(50, 10, [0, 255, 0, 255]); // Tile (0,1)
      anvil.setPixel(10, 50, [0, 0, 255, 255]); // Tile (1,0)

      const dirtyTiles = anvil.getDirtyTileIndices();
      expect(dirtyTiles).toHaveLength(3);

      // Check that all expected tiles are marked dirty
      const tileSet = new Set(dirtyTiles.map((t: TileIndex) => `${t.row},${t.col}`));
      expect(tileSet.has('0,0')).toBe(true);
      expect(tileSet.has('0,1')).toBe(true);
      expect(tileSet.has('1,0')).toBe(true);
    });

    it('should clear dirty tiles after flush', () => {
      anvil.setPixel(20, 20, [128, 128, 128, 255]);

      expect(anvil.getDirtyTileIndices()).toHaveLength(1);

      anvil.clearDirtyTiles();

      expect(anvil.getDirtyTileIndices()).toHaveLength(0);
    });

    it('should handle tile uniform color optimization', () => {
      const uniformColor: RGBA = [100, 150, 200, 255];

      // Fill entire tile with same color
      for (let y = 0; y < tileSize; y++) {
        for (let x = 0; x < tileSize; x++) {
          anvil.setPixel(x, y, uniformColor);
        }
      }

      // Tile should be marked as having uniform color
      const tileColor = anvil.getTileUniformColor({ row: 0, col: 0 });
      expect(tileColor).toEqual(uniformColor);
    });
  });

  describe('Performance and Memory', () => {
    it('should handle large batch operations efficiently', () => {
      const startTime = performance.now();
      const uniquePositions = new Set<string>();

      // Perform many pixel operations
      for (let i = 0; i < 1000; i++) {
        const x = Math.floor(Math.random() * width);
        const y = Math.floor(Math.random() * height);
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
      anvil.setPixel(25, 25, [255, 0, 0, 255]);
      anvil.setPixel(25, 25, [0, 255, 0, 255]);
      anvil.setPixel(25, 25, [0, 0, 255, 255]);
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
      expect(() => anvil.setPixel(width - 1, height - 1, validColor)).not.toThrow();

      // Test just outside bounds
      expect(() => anvil.setPixel(-1, 0, validColor)).toThrow();
      expect(() => anvil.setPixel(width, 0, validColor)).toThrow();
      expect(() => anvil.setPixel(0, -1, validColor)).toThrow();
      expect(() => anvil.setPixel(0, height, validColor)).toThrow();
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

      expect(() => anvil.setPixel(0, 0, [255, 0, 0, 255])).not.toThrow();
      expect(() => anvil.setPixel(1, 0, [255, 0, 0, 255])).toThrow();
      expect(() => anvil.setPixel(0, 1, [255, 0, 0, 255])).toThrow();
    });
  });
});
