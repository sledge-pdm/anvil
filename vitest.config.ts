import topLevelAwait from 'vite-plugin-top-level-await';
import wasmPlugin from 'vite-plugin-wasm';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [wasmPlugin(), topLevelAwait()],
  test: {
    environment: 'node',
    globals: true,
    setupFiles: [],
    include: ['test/**/*.test.(ts|tsx)'],
    exclude: [],
    benchmark: {
      include: ['test/**/*.bench.(ts|tsx)'],
    },
  },
  resolve: {
    alias: {},
  },
});
