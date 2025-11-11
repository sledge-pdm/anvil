export type RawPixelData = Uint8Array | Uint8ClampedArray;

/** Ensure a Uint8Array view on the underlying buffer */
export function toUint8Array(buffer: RawPixelData): Uint8Array {
  if (buffer instanceof Uint8Array) {
    return buffer;
  }
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

/** Ensure a Uint8ClampedArray view on the underlying buffer */
export function toUint8ClampedArray(buffer: RawPixelData): Uint8ClampedArray {
  if (buffer instanceof Uint8ClampedArray) {
    if (buffer.byteOffset === 0 && buffer.byteLength === buffer.buffer.byteLength) {
      return buffer;
    }
    return new Uint8ClampedArray(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }
  return new Uint8ClampedArray(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}
