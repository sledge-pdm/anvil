import { RGBA } from '../../src/models/RGBA';
import { RgbaBuffer } from '../../src/wasm/pkg/anvil_wasm';

export const BLACK: RGBA = [0, 0, 0, 255];
export const WHITE: RGBA = [255, 255, 255, 255];
export const RED: RGBA = [255, 0, 0, 255];
export const GREEN: RGBA = [0, 255, 0, 255];
export const BLUE: RGBA = [0, 0, 255, 255];
export const TRANSPARENT: RGBA = [0, 0, 0, 0];
export const CYAN: RGBA = [0, 255, 255, 255];
export const MAGENTA: RGBA = [255, 0, 255, 255];
export const YELLOW: RGBA = [255, 255, 0, 255];

export function semiTransparent(color: RGBA): RGBA {
  return [color[0], color[1], color[2], 128];
}

/**
 * @description returns coordinate-specific color
 */
export const coordinateColor = (x: number, y: number): RGBA => [x, y, (x + y) % 256, 255];

/**
 * @description returns RgbaBuffer filled with coordinateColors
 */
export const coordinateColoredBuffer = (w: number, h: number) => {
  const buf = new RgbaBuffer(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      buf.set(x, y, ...coordinateColor(x, y));
    }
  }
  return buf;
};
