# Anvil Test

## Layout

* Feature suites live under `test/features/<domain>/...` (anvil: core/PixelBuffer/DiffsController/TilesController, pattern, resize, packing, effects)
* Cross-feature or roundtrip tests go to `test/integration/*`
* Use `sledge-test/README.md` as a style reference for helper size and data setup

## Do

* If it's not small test (like unit test), write tests following the actual usecases.
* Write helpers that cleary show what it does.
* use `UPPER_SNAKE_CASE` for shared const (not only exported const).

## Don't

* Don't write "tiny" helpers like `resizeAnvil(anvil, width, height)`. Just use existing method (e.g, `anvil.resize(width, height)`) instead of wrapping it.
* Don't write "high-definition" helpers `setup([no args])`. It just conceals what that test actually means by wrapping its preconditions and operations.
* Unless absolutely necessary, don't modify buffer directly (e.g, buf[idx] = 0). Use existing method in Anvil/ops.
* Don't mock WASM methods.

## Next

* Replace perf/random-based cases with deterministic checks or skip them when unreliable
