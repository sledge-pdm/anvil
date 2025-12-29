import { describe, expect, it } from 'vitest';
import { Anvil } from '../../src/Anvil';
import { AnvilAPI } from '../../src/AnvilAPI';
import { rgbaToPackedU32 } from '../../src/ops/Packing';
import { RED, TRANSPARENT } from '../support/colors';

describe('AnvilAPI integration', () => {
  it('writes only to the target layer buffer', () => {
    const anvil = new Anvil(8, 8, 2);
    const api0 = new AnvilAPI(anvil, 0);
    const api1 = new AnvilAPI(anvil, 1);

    api0.setPixel({ x: 2, y: 3 }, RED);

    expect(anvil.getLayer(0).buffer.getPixel({ x: 2, y: 3 })).toEqual(RED);
    expect(anvil.getLayer(1).buffer.getPixel({ x: 2, y: 3 })).toEqual(TRANSPARENT);

    api1.setPixel({ x: 2, y: 3 }, RED);
    expect(anvil.getLayer(1).buffer.getPixel({ x: 2, y: 3 })).toEqual(RED);
  });

  it('registerDiff connects to lapse undo/redo', () => {
    const anvil = new Anvil(8, 8, 1);
    const api = new AnvilAPI(anvil, 0);
    const layer = anvil.getLayer(0);

    api.setPixel({ x: 1, y: 1 }, RED);
    api.registerDiff({
      pixels: [{ x: 1, y: 1, color: rgbaToPackedU32(TRANSPARENT) }],
    });

    layer.lapse.undo();
    expect(layer.buffer.getPixel({ x: 1, y: 1 })).toEqual(TRANSPARENT);

    layer.lapse.redo();
    expect(layer.buffer.getPixel({ x: 1, y: 1 })).toEqual(RED);
  });
});
