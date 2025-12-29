import { RGBA, Vec2 } from '@sledge-pdm/core';
import { API } from './API';
import { Anvil } from './Anvil';
import { PackedDiffs } from './types/patch/Patch';

export class AnvilAPI implements API {
  constructor(
    private anvil: Anvil,
    private layerIndex = 0
  ) {}

  private get layer() {
    return this.anvil.getLayer(this.layerIndex);
  }

  setPixel(pos: Vec2, color: RGBA): void {
    this.layer.buffer.setPixel(pos, color);

    // remove pixel diff and don't to diff related things here (it's up to grip tools)
  }

  // register completed diff (e.g, stroke)
  registerDiff(diffs: PackedDiffs) {
    this.layer.lapse.registerDiff(diffs);
  }
}
