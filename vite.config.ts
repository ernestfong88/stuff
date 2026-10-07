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
    // Agent and git worktrees live under .claude/; never test those copies.
    exclude: [...configDefaults.exclude, '.claude/**'],
  },
});
