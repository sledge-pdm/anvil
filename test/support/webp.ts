import { existsSync, readFileSync } from 'fs';

export const loadWebp = (path: URL) => {
  if (!existsSync(path)) {
    console.warn(`WARN: missing image ${path.pathname}`);
    return undefined;
  }
  return new Uint8Array(readFileSync(path));
};

type Size = { width: number; height: number };

export const parseWebpSize = (buf: Uint8Array): Size | undefined => {
  // RIFF header is 12 bytes: "RIFF" [4-byte size] "WEBP"
  if (buf.length < 30 || String.fromCharCode(...buf.slice(0, 4)) !== 'RIFF') return undefined;
  let offset = 12;
  while (offset + 8 <= buf.length) {
    const tag = String.fromCharCode(...buf.slice(offset, offset + 4));
    const size = buf[offset + 4] | (buf[offset + 5] << 8) | (buf[offset + 6] << 16) | (buf[offset + 7] << 24);
    const dataStart = offset + 8;
    if (tag === 'VP8 ' && buf.length >= dataStart + 10) {
      const w = buf[dataStart + 6] | (buf[dataStart + 7] << 8);
      const h = buf[dataStart + 8] | (buf[dataStart + 9] << 8);
      return { width: (w & 0x3fff) >>> 0, height: (h & 0x3fff) >>> 0 };
    }
    if (tag === 'VP8L' && buf.length >= dataStart + 5) {
      const b0 = buf[dataStart + 1];
      const b1 = buf[dataStart + 2];
      const b2 = buf[dataStart + 3];
      const b3 = buf[dataStart + 4];
      const width = 1 + (((b1 & 0x3f) << 8) | b0);
      const height = 1 + (((b3 & 0xf) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
      return { width, height };
    }
    if (tag === 'VP8X' && buf.length >= dataStart + 10) {
      const w = buf[dataStart + 4] | (buf[dataStart + 5] << 8) | (buf[dataStart + 6] << 16);
      const h = buf[dataStart + 7] | (buf[dataStart + 8] << 8) | (buf[dataStart + 9] << 16);
      return { width: w + 1, height: h + 1 };
    }
    offset = dataStart + size + (size % 2); // padding to even boundary
  }
  return undefined;
};
