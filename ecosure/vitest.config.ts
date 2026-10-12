import { defineConfig } from 'vitest/config';

// Unit tests only; the browser tests in e2e/ run through Playwright.
export default defineConfig({ test: { include: ['tests/**/*.test.ts'] } });
