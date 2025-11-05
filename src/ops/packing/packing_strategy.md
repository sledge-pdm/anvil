# Packing Strategy

- I want to achieve:
  1. Usability: not need to use packing method in the application code. just add pixel diffs by raw position and colors, and flush them to store packed diffs, and get unpacked diffs when applying or getting information.
  2. Performance: should detect duplication of pixels/tiles diff by some sort of key generated from tile index.
  3. Efficiency: should use less memory for storing diffs. packing everything we can, while it's not too expensive to pack/unpack.

## Data Structures

- Pixel: each pixel diff
- Tile: tile "fill" diff (note that this is different from pixel diffs fills an entire tile)
- Partial: partial diff (partial buffer)
- Whole: whole diff (whole layer buffer)

> I think it's kinda wasteful to split pixel diffs and tile diffs.
> They already use same pending strategy that uses tile-key.
> Though flood fill with pixel diffs might consume huge memory in worst case... (maybe can switch to partial/whole diff like pentool does now. This might be way lighter because now patch/whole diffs uses webp packing)

## Steps

- Anvil already have three levels of data structure steps to achieve the above goals:
  1. "unpacked" structure: just human-readable structure that uses raw pixel diff(x,y,before,after), or raw buffers.
  2. "pending" structure: intermediate structure that uses Map to store diffs by tile key.
  3. "packed" structure: final structure that uses packed buffers to store diffs.

## Problems

- We have soooo many kinds of "Diff Types" (4 structures \* 3 steps = 12 types).
- Currently, diff systems are toooo messy. too many legacy optimizations that is forgotten to fix. None of the goals are achieved.
- We can reduce the number of types by merging pixel diffs and tile diffs, but still we have 9 types.
- I think pending structure can be included into diff systems, like "PendingLayerDiffsController" because pending types are just intermediate structure that bridges unpacked and packed steps with "addXXX" methods and "flush" method.

## Notes

- Pixel diffs are packed to "PackedPixelsPatchData" that contains array of pixel diffs in a tile. make sure that pixel diffs are reduced to "batch" in packing.

## Idea

### types

- PixelPatchData / PackedPixelsPatchData
- TilePatchData / PackedTilePatchData
- PartialPatchData / PackedPartialPatchData
- WholePatchData / PackedWholePatchData

### anvil method (unpacked step)

```ts
addPixelDiff(x: number, y: number, before: RGBA, after: RGBA): void
addTileDiff(tileIndex: TileIndex, before: RGBA, after: RGBA): void
addPartialDiff(before: PixelBuffer, after: PixelBuffer): void
addWholeDiff(before: PixelBuffer, after: PixelBuffer): void
```

### LayerDiffsController method (pending+packed step)

> key idea: pending structure = tile-key + "packed"/"unpacked" pixel diffs, then structure definitions are much simpler. (no need to define PendingXXX types.)\
> packed version will pack diffs on adding them to pending. unpacked version will pack diffs on flush(). it's worse to consider.
> the code below is written in unpacked version, which is easier to handle pixels.

```ts
interface PendingDiffs {
  pixels: Map<string, PixelPatchData[]>; // key=tileKey
  tiles: Map<string, TilePatchData>; // key=tileKey
  partialDiff: PartialPatchData;
  whole?: WholePatchData;
}
pendingDiffs: PendingDiffs;

addPixel(patch: PixelPatchData, tileIndex: TileIndex): void
addTile(patch: TilePatchData): void
addPartial(unpacked: PartialPatchData): void
addWhole(unpacked: WholePatchData): void
```

### Packing.ts method (packing/unpacking step)

```ts
interface PackedDiffs {
  pixels: PackedPixelsPatchData[];
  tiles: PackedTilePatchData[];
  partialDiff: PackedPartialPatchData;
  whole?: PackedWholePatchData;
}

export function packPending(pendingDiffs: PendingDiffs): PackedDiffs {
  // pack each diffs
}
```
