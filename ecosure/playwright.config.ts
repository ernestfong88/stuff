import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

// Cloud sessions ship a Chromium at this path; elsewhere Playwright uses its own download.
const local = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  use: { baseURL: 'http://localhost:5174', launchOptions: existsSync(local) ? { executablePath: local } : {} },
  webServer: { command: 'npx vite --port 5174 --strictPort', url: 'http://localhost:5174', reuseExistingServer: true },
});
