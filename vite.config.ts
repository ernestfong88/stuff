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
  test: {
    // Worktrees under .claude/ are other checkouts; e2e/ runs under Playwright.
    exclude: [...configDefaults.exclude, '.claude/**', 'e2e/**'],
  },
});
