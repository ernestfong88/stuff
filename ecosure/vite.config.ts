import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// One self-contained HTML file (pdf.js included) so the page can be published as a claude.ai artifact
// or opened straight from disk.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2022', chunkSizeWarningLimit: 12000, assetsInlineLimit: 100000000 },
  worker: { format: 'es' },
});
