import { AntialiasMode, patch_buffer_rgba_instant, PatchBufferRgbaOption } from '../../ops_wasm/pkg/anvil_ops_wasm.js';

export { AntialiasMode };
interface TransferOptions {
  scaleX?: number;
  scaleY?: number;
  rotate?: number;
  offsetX?: number;
  offsetY?: number;
  flipX?: boolean;
  flipY?: boolean;
  antialiasMode?: AntialiasMode;
}

// WebGL合成は特殊なのでsledgeに残す。実装するにしてもこのようにBlendModeを@sledge/coreから引っ張ってくるので、色々と面倒になる。保留。
// interface WebGLTransferOptions extends TransferOptions {
//     blendMode?: BlendMode
// }

export function transferBufferInstant(
  source: Uint8ClampedArray,
  sourceWidth: number,
  sourceHeight: number,
  target: Uint8ClampedArray,
  targetWidth: number,
  targetHeight: number,
  options?: TransferOptions
): void {
  const {
    scaleX = 1.0,
    scaleY = 1.0,
    rotate = 0,
    offsetX = 0,
    offsetY = 0,
    flipX = false,
    flipY = false,
    antialiasMode = AntialiasMode.Nearest,
  } = options || {};

  try {
    patch_buffer_rgba_instant(
      new Uint8Array(target.buffer, target.byteOffset, target.byteLength),
      targetWidth,
      targetHeight,
      new Uint8Array(source.buffer, source.byteOffset, source.byteLength),
      sourceWidth,
      sourceHeight,
      offsetX,
      offsetY,
      scaleX,
      scaleY,
      rotate,
      new PatchBufferRgbaOption(antialiasMode)
    );
  } catch (e) {
    console.error('transferBuffer wasm error', e);
  }
}
