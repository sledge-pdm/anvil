// 現状、sledge側で「転写」に関する処理が複数存在する
// 画像 => ImageTransferApplier
// 下のレイヤーと合成 => LayerMergeApplier
// 選択範囲をレイヤーに転写 => FloatingBufferApplier

import { AntialiasMode, patch_buffer_rgba_instant, PatchBufferRgbaOption } from '../../ops_wasm/pkg/anvil_ops_wasm.js';

export { AntialiasMode };

// レイヤー合成だけは単なる上書きだけではなくwebGL合成を行うので少し異なるが、基本的にバッファをバッファの上にオフセットやスケールを指定して転写するのは変わらない
// 今後、画像や選択範囲の変形等もサポートすることを考えると、LayerMerge以外の転写操作はAnvilのここに集約したい。

interface TransferOptions {
  scaleX?: number;
  scaleY?: number;
  rotate?: number;
  offsetX?: number;
  offsetY?: number;
  antialiasMode?: AntialiasMode;
}

// 前述のとおりWebGL合成は特殊なのでsledgeに残す。実装するにしてもこのようにBlendModeを@sledge/coreから引っ張ってくるので、色々と面倒になる。保留。
// interface WebGLTransferOptions extends TransferOptions {
//     blendMode?: BlendMode
// }

export function   transferBufferInstant(
  source: Uint8ClampedArray,
  sourceWidth: number,
  sourceHeight: number,
  target: Uint8ClampedArray,
  targetWidth: number,
  targetHeight: number,
  options?: TransferOptions
): void {
  const { scaleX = 1.0, scaleY = 1.0, rotate = 0, offsetX = 0, offsetY = 0, antialiasMode = AntialiasMode.Nearest } = options || {};

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
