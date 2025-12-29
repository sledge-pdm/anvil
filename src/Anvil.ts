import { Buffer } from './buffer/Buffer';
import { Lapse } from './lapse/Lapse';

export interface Layer {
  buffer: Buffer;
  lapse: Lapse;
}

export class Anvil {
  private layers: Layer[];
  private width: number;
  private height: number;

  constructor(width: number, height: number, layerCount = 1) {
    this.width = width;
    this.height = height;
    this.layers = [];

    for (let i = 0; i < layerCount; i += 1) {
      this.layers.push(this.createLayer());
    }
  }

  getSize() {
    return { width: this.width, height: this.height };
  }

  getLayerCount(): number {
    return this.layers.length;
  }

  getLayer(index = 0): Layer {
    const layer = this.layers[index];
    if (!layer) {
      throw new Error(`Layer index ${index} is out of range`);
    }
    return layer;
  }

  addLayer(): Layer {
    const layer = this.createLayer();
    this.layers.push(layer);
    return layer;
  }

  private createLayer(): Layer {
    const buffer = new Buffer(this.width, this.height);
    const lapse = new Lapse(buffer);
    return { buffer, lapse };
  }
}
