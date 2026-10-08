import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // Relative base so the build also works from a sub-path or opened as files.
  base: './',
  build: {
    // React in a chunk of its own, cached across releases (the app's code changes far more often).
    // lucide-react icons stay where Rolldown puts them: one chunk of every icon would load
    // on every screen with the entry (about 8 KB gzip more on the kitchen screens).
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ }],
        },
      },
    },
  },
  test: {
    // Worktrees under .claude/ are other checkouts; e2e/ runs under Playwright.
    exclude: [...configDefaults.exclude, '.claude/**', 'e2e/**'],
  },
});
