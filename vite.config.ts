import { defineConfig } from 'vite';

// Relative base so the build works both locally and under /kiruna-the-game/ on GitHub Pages.
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 6000 },
});
