import { RGBA, Vec2 } from '@sledge-pdm/core';
import type { PackedDiffs } from './types/patch/Patch';

export interface API {
  setPixel(pos: Vec2, color: RGBA): void;
  registerDiff(diffs: PackedDiffs): void;
}
