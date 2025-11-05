import { beforeEach, describe, expect, it } from 'vitest';
import { LayerDiffsController } from '../src/buffer/LayerDiffsController';
import { LayerTilesController } from '../src/buffer/LayerTilesController';
import { PixelBuffer } from '../src/buffer/PixelBuffer';
import type { RGBA } from '../src/types/types';

describe('LayerDiffsController', () => {
  let buffer: PixelBuffer;
  let tilesController: LayerTilesController;
  let diffsController: LayerDiffsController;
  const bufferWidth = 64;
  const bufferHeight = 64;
  const tileSize = 32;

  beforeEach(() => {
    buffer = new PixelBuffer(bufferWidth, bufferHeight);
    tilesController = new LayerTilesController(buffer, bufferWidth, bufferHeight, tileSize);
    diffsController = new LayerDiffsController();
  });

  describe('Basic functionality', () => {
    it('should initialize empty', () => {
      expect(diffsController.hasPendingChanges()).toBe(false);
    });

    it('should accumulate pixel diffs', () => {
      diffsController.addPixel({
        x: 0,
        y: 5,
        color: [0, 255, 0, 255],
      });
      diffsController.addPixel({
        x: 0,
        y: 10,
        color: [255, 255, 0, 255],
      });

      expect(diffsController.hasPendingChanges()).toBe(true);

      const pending = diffsController.flush();
      expect(pending).toBeDefined();
      expect(pending?.pixels).toHaveLength(2);
    });

    it('should handle whole buffer changes', () => {
      const swapBuffer = new Uint8ClampedArray(bufferWidth * bufferHeight * 4);
      swapBuffer.fill(200);

      diffsController.addWhole({
        swapBuffer,
        width: bufferWidth,
        height: bufferHeight,
      });

      expect(diffsController.hasPendingChanges()).toBe(true);

      const pending = diffsController.flush();
      expect(pending).toBeDefined();
      expect(pending?.whole).toBeDefined();
    });

    it('should handle partial buffer changes', () => {
      const boundBox = { x: 10, y: 10, width: 20, height: 20 };
      const swapBuffer = new Uint8ClampedArray(boundBox.width * boundBox.height * 4);
      swapBuffer.fill(128);

      diffsController.addPartial({
        boundBox,
        swapBuffer,
      });

      expect(diffsController.hasPendingChanges()).toBe(true);

      const pending = diffsController.flush();
      expect(pending).toBeDefined();
      expect(pending?.partial).toBeDefined();
    });

    it('should clear all changes', () => {
      diffsController.addPixel({
        x: 5,
        y: 5,
        color: [255, 0, 0, 255],
      });

      expect(diffsController.hasPendingChanges()).toBe(true);

      diffsController.discard();

      expect(diffsController.hasPendingChanges()).toBe(false);
    });

    describe('Pixel operations', () => {
      it('should handle single pixel changes', () => {
        const color: RGBA = [255, 128, 64, 200];

        diffsController.addPixel({
          x: 10,
          y: 15,
          color,
        });

        expect(diffsController.hasPendingChanges()).toBe(true);

        const patch = diffsController.previewPatch();
        expect(patch).toBeDefined();
        expect(patch?.pixels).toHaveLength(1);
      });

      it('should flush changes correctly', () => {
        diffsController.addPixel({
          x: 10,
          y: 10,
          color: [255, 255, 255, 255],
        });

        expect(diffsController.hasPendingChanges()).toBe(true);

        const patch = diffsController.flush();

        expect(patch).toBeDefined();
        expect(diffsController.hasPendingChanges()).toBe(false);
      });
    });

    describe('Mixed operations', () => {
      it('should handle multiple pixel changes', () => {
        const redColor: RGBA = [255, 0, 0, 255];
        const greenColor: RGBA = [0, 255, 0, 255];

        // Individual pixel changes in different locations
        diffsController.addPixel({ x: 5, y: 5, color: redColor });
        diffsController.addPixel({ x: 10, y: 10, color: redColor });
        diffsController.addPixel({ x: 15, y: 15, color: redColor });

        // More pixel changes in a different area
        diffsController.addPixel({ x: 35, y: 35, color: greenColor });
        diffsController.addPixel({ x: 40, y: 40, color: greenColor });

        const patch = diffsController.previewPatch();

        expect(patch?.pixels).toBeDefined();
        expect(patch?.pixels?.length).toBeGreaterThan(0);
        expect(patch?.whole).toBeUndefined();
        expect(patch?.partial).toBeUndefined();
      });

      it('should handle whole buffer replacement', () => {
        const bufferSize = bufferWidth * bufferHeight * 4;
        const swapBuffer = new Uint8ClampedArray(bufferSize);
        swapBuffer.fill(255);

        diffsController.addWhole({
          swapBuffer,
          width: bufferWidth,
          height: bufferHeight,
        });

        expect(diffsController.hasPendingChanges()).toBe(true);

        const patch = diffsController.previewPatch();
        expect(patch?.whole).toBeDefined();
        expect(patch?.pixels).toBeUndefined();
        expect(patch?.partial).toBeUndefined();
      });

      it('should handle partial buffer changes', () => {
        const boundBox = { x: 16, y: 16, width: 32, height: 32 };
        const swapBuffer = new Uint8ClampedArray(boundBox.width * boundBox.height * 4);
        swapBuffer.fill(128);

        diffsController.addPartial({
          boundBox,
          swapBuffer,
        });

        expect(diffsController.hasPendingChanges()).toBe(true);

        const patch = diffsController.previewPatch();
        expect(patch?.partial).toBeDefined();
        expect(patch?.pixels).toBeUndefined();
        expect(patch?.whole).toBeUndefined();
      });
    });

    describe('Integration scenarios', () => {
      it('should handle complex editing session', () => {
        // Phase 1: Draw some pixels
        for (let i = 0; i < 10; i++) {
          diffsController.addPixel({
            x: i * 3,
            y: i * 2,
            color: [i * 25, 255 - i * 25, 128, 255],
          });
        }

        expect(diffsController.hasPendingChanges()).toBe(true);

        const patch = diffsController.flush();

        expect(patch).toBeDefined();
        expect(patch?.pixels).toBeDefined();

        // After flush, diffs should be clean
        expect(diffsController.hasPendingChanges()).toBe(false);
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
          diffsController.addPixel({
            x,
            y,
            color: [index * 60, index * 60, index * 60, 255],
          });
        });

        expect(diffsController.hasPendingChanges()).toBe(true);

        const patch = diffsController.previewPatch();
        expect(patch?.pixels).toBeDefined();
      });

      it('should discard pending changes when requested', () => {
        diffsController.addPixel({
          x: 10,
          y: 10,
          color: [255, 0, 0, 255],
        });

        expect(diffsController.hasPendingChanges()).toBe(true);

        diffsController.discard();

        expect(diffsController.hasPendingChanges()).toBe(false);
      });

      it('should handle partial buffer operations', () => {
        const boundBox = { x: 10, y: 10, width: 32, height: 32 };
        const swapBuffer = new Uint8ClampedArray(boundBox.width * boundBox.height * 4);

        // Fill with a pattern
        for (let i = 0; i < swapBuffer.length; i += 4) {
          swapBuffer[i] = 100; // R
          swapBuffer[i + 1] = 150; // G
          swapBuffer[i + 2] = 200; // B
          swapBuffer[i + 3] = 255; // A
        }

        diffsController.addPartial({
          boundBox,
          swapBuffer,
        });

        expect(diffsController.hasPendingChanges()).toBe(true);

        const patch = diffsController.previewPatch();
        expect(patch?.partial).toBeDefined();
        expect(patch?.partial?.boundBox).toEqual(boundBox);
      });

      it('should override pixel changes with partial changes', () => {
        // First add pixel changes
        diffsController.addPixel({ x: 5, y: 5, color: [255, 0, 0, 255] });
        diffsController.addPixel({ x: 10, y: 10, color: [0, 255, 0, 255] });

        let patch = diffsController.previewPatch();
        expect(patch?.pixels).toBeDefined();
        expect(patch?.partial).toBeUndefined();

        // Then add partial change - should override pixel changes
        const boundBox = { x: 0, y: 0, width: 32, height: 32 };
        const swapBuffer = new Uint8ClampedArray(boundBox.width * boundBox.height * 4);
        swapBuffer.fill(128);

        diffsController.addPartial({
          boundBox,
          swapBuffer,
        });

        patch = diffsController.previewPatch();
        expect(patch?.partial).toBeDefined();
        expect(patch?.pixels).toBeUndefined(); // Pixel changes should be cleared
      });

      it('should override everything with whole buffer changes', () => {
        // Add pixel changes
        diffsController.addPixel({ x: 5, y: 5, color: [255, 0, 0, 255] });

        // Add partial change
        const boundBox = { x: 10, y: 10, width: 16, height: 16 };
        const partialBuffer = new Uint8ClampedArray(boundBox.width * boundBox.height * 4);
        partialBuffer.fill(100);
        diffsController.addPartial({ boundBox, swapBuffer: partialBuffer });

        // Then add whole buffer change - should override everything
        const wholeBuffer = new Uint8ClampedArray(bufferWidth * bufferHeight * 4);
        wholeBuffer.fill(200);
        diffsController.addWhole({
          swapBuffer: wholeBuffer,
          width: bufferWidth,
          height: bufferHeight,
        });

        const patch = diffsController.previewPatch();
        expect(patch?.whole).toBeDefined();
        expect(patch?.partial).toBeUndefined();
        expect(patch?.pixels).toBeUndefined();
      });
    });

    describe('Preview and flush operations', () => {
      it('should return undefined when no changes are pending', () => {
        const patch = diffsController.previewPatch();
        expect(patch).toBeUndefined();
      });

      it('should preview without affecting internal state', () => {
        diffsController.addPixel({ x: 10, y: 10, color: [255, 0, 0, 255] });

        expect(diffsController.hasPendingChanges()).toBe(true);

        const patch1 = diffsController.previewPatch();
        expect(patch1).toBeDefined();
        expect(diffsController.hasPendingChanges()).toBe(true); // Should still have pending changes

        const patch2 = diffsController.previewPatch();
        expect(patch2).toBeDefined();
        expect(diffsController.hasPendingChanges()).toBe(true); // Should still have pending changes
      });

      it('should flush and clear internal state', () => {
        diffsController.addPixel({ x: 10, y: 10, color: [255, 0, 0, 255] });

        expect(diffsController.hasPendingChanges()).toBe(true);

        const patch = diffsController.flush();
        expect(patch).toBeDefined();
        expect(diffsController.hasPendingChanges()).toBe(false); // Should be cleared after flush
      });

      it('should preview partial changes without affecting internal state', () => {
        const boundBox = { x: 20, y: 20, width: 24, height: 24 };
        const swapBuffer = new Uint8ClampedArray(boundBox.width * boundBox.height * 4);
        swapBuffer.fill(64);

        diffsController.addPartial({ boundBox, swapBuffer });

        expect(diffsController.hasPendingChanges()).toBe(true);

        const patch1 = diffsController.previewPatch();
        expect(patch1).toBeDefined();
        expect(patch1?.partial).toBeDefined();
        expect(diffsController.hasPendingChanges()).toBe(true); // Should still have pending changes

        const patch2 = diffsController.previewPatch();
        expect(patch2).toBeDefined();
        expect(patch2?.partial).toBeDefined();
        expect(diffsController.hasPendingChanges()).toBe(true); // Should still have pending changes
      });

      it('should flush partial changes and clear internal state', () => {
        const boundBox = { x: 8, y: 8, width: 16, height: 16 };
        const swapBuffer = new Uint8ClampedArray(boundBox.width * boundBox.height * 4);
        swapBuffer.fill(192);

        diffsController.addPartial({ boundBox, swapBuffer });

        expect(diffsController.hasPendingChanges()).toBe(true);

        const patch = diffsController.flush();
        expect(patch).toBeDefined();
        expect(patch?.partial).toBeDefined();
        expect(diffsController.hasPendingChanges()).toBe(false); // Should be cleared after flush
      });
    });
  });
});
