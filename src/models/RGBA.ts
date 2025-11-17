export type RGBA = [r: number, g: number, b: number, a: number];

export const transparent: RGBA = [0, 0, 0, 0];

export function hexToRGBA(hex: string): RGBA {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  let a = parseInt(hex.slice(6, 8), 16);
  if (!a) a = 255;
  return [r, g, b, a];
}

export function hexWithSharpToRGBA(hex: string): RGBA {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  let a = parseInt(hex.slice(7, 9), 16);
  if (!a) a = 255;
  return [r, g, b, a];
}

interface RGBAToHexOptions {
  excludeAlpha?: boolean;
  withSharp?: boolean;
}

export function RGBAToHex(color: RGBA, options?: RGBAToHexOptions): string {
  const { excludeAlpha = false, withSharp = false } = options || {};
  const rHex = color[0].toString(16).padStart(2, '0');
  const gHex = color[1].toString(16).padStart(2, '0');
  const bHex = color[2].toString(16).padStart(2, '0');
  let prefix = withSharp ? '#' : '';
  if (excludeAlpha) {
    return `${prefix}${rHex}${gHex}${bHex}`;
  } else {
    const aHex = color[3].toString(16).padStart(2, '0');
    return `${prefix}${rHex}${gHex}${bHex}${aHex}`;
  }
}

export function colorMatch(a: RGBA, b: RGBA): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
}

export function isTransparent(a: RGBA): boolean {
  return a[3] === 0 || a[3] === undefined;
}
