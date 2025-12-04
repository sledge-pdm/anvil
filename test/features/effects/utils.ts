import { existsSync, readdirSync } from 'node:fs';
import { webpToRaw } from '../../../src/ops/Packing';
import { RgbaBuffer } from '../../../src/wasm/pkg/anvil_wasm';
import { loadWebp, parseWebpSize } from '../../support/webp';

interface FXVerifyImage {
  buffer: Uint8Array;
  width: number;
  height: number;
}

interface FXVerifyImageSet {
  original: FXVerifyImage;
  applied: FXVerifyImage;
}

/**
 * @description load matching original/applied webp image set
 */
export function loadVerifySets(name: string, url: string): Map<string, FXVerifyImageSet> | undefined {
  const result = new Map<string, FXVerifyImageSet>();

  const load = (path: string): FXVerifyImageSet | undefined => {
    const originalWebp = loadWebp(new URL(`${path}/original.webp`, url));
    const appliedWebp = loadWebp(new URL(`${path}/applied.webp`, url));
    if (originalWebp && appliedWebp) {
      const origSize = parseWebpSize(originalWebp);
      const appliedSize = parseWebpSize(appliedWebp);
      if (origSize && appliedSize) {
        if (origSize.width !== appliedSize.width || origSize.height !== appliedSize.height) {
          // just warn because FX might actually change buffer size
          console.warn(
            `FX ${name}: size does not match between original (${origSize.width}x${origSize.height}) and applied (${appliedSize.width}x${appliedSize.height})`
          );
        }
        const origRaw = webpToRaw(originalWebp, origSize.width, origSize.height);
        const appliedRaw = webpToRaw(appliedWebp, appliedSize.width, appliedSize.height);
        if (origRaw && appliedRaw) {
          const set: FXVerifyImageSet = {
            original: {
              buffer: origRaw,
              width: origSize.width,
              height: origSize.height,
            },
            applied: {
              buffer: appliedRaw,
              width: appliedSize.width,
              height: appliedSize.height,
            },
          };
          return set;
        }
      }
    }
    return undefined;
  };

  const imageDirUrl = new URL('./image', url);
  if (!existsSync(imageDirUrl)) {
    console.warn(`FX ${name}: image dir not found.`);
    return undefined;
  }

  // root set (warn if root not set)
  const rootSet = load('./image');
  if (rootSet) result.set('root', rootSet);

  const entries = readdirSync(imageDirUrl, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const set = load(`./image/${entry.name}`);
      if (set) result.set(entry.name, set);
    }
  }

  if (result.size === 0) {
    console.error(`FX ${name}: No available image sets for test.`);
    return undefined;
  }

  return result;
}

/**
 * @description verify sets of original/applied image with specified operation
 */
export function verifySets(name: string, sets: Map<string, FXVerifyImageSet>, modifyOps: (original: RgbaBuffer) => void): boolean {
  if (sets.size === 0) {
    throw new Error(`FX ${name}: No available image sets for test.`);
  }

  for (const [key, set] of sets.entries()) {
    const { original, applied } = set;

    const buffer = RgbaBuffer.fromRaw(original.width, original.height, original.buffer);
    modifyOps(buffer);
    const result = buffer.data();

    if (result.length !== applied.buffer.length) {
      throw new Error(`FX ${name} / set "${key}": image sizes do not match (result:${result.length} vs expected:${applied.buffer.length})`);
    }

    if (!isBufferEqual(result, applied.buffer)) {
      throw new Error(`FX ${name} / set "${key}": result not equal to expected applied image`);
    }
  }

  return true;
}

function isBufferEqual(a: Uint8Array | Uint8ClampedArray, b: Uint8Array | Uint8ClampedArray): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }

  return true;
}
