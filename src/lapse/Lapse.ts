import type { Buffer } from '../buffer/Buffer';
import { PackedDiffs } from '../types/patch/Patch';

export class Lapse {
  private undoStack: PackedDiffs[] = [];
  private redoStack: PackedDiffs[] = [];
  private buffer?: Buffer;

  constructor(buffer?: Buffer) {
    this.buffer = buffer;
  }

  setBuffer(buffer: Buffer) {
    this.buffer = buffer;
  }

  registerDiff(diff: PackedDiffs) {
    this.undoStack.push(diff);
    this.redoStack = [];
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  undo(): PackedDiffs | null {
    const patch = this.undoStack.pop();
    if (!patch) {
      return null;
    }
    if (!this.buffer) {
      throw new Error('Lapse buffer is not set');
    }
    this.buffer.applyPatch(patch, 'undo');
    this.redoStack.push(patch);
    return patch;
  }

  redo(): PackedDiffs | null {
    const patch = this.redoStack.pop();
    if (!patch) {
      return null;
    }
    if (!this.buffer) {
      throw new Error('Lapse buffer is not set');
    }
    this.buffer.applyPatch(patch, 'redo');
    this.undoStack.push(patch);
    return patch;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }
}
