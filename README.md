# Anvil

Anvil is the pixel buffer processing package for [sledge](https://github.com/sledge-pdm/sledge).

<img src="./icon_120.png" width="96" height="96" style="image-rendering: pixelated;"  />

## Features
* Flexible diff management (pixel/partial/whole)
* Tile states management
* WASM buffer operations

## The Goal
* Memory efficient buffer operations
* Simple interfaces
> After all I want to do the same thing as [sharp](https://sharp.pixelplumbing.com/) does (but without using libvips which causes many problem in tauri)