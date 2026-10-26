import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  workers: 2,
  timeout: 45000,
  expect: { timeout: 10000 },
  reporter: 'list',
  use: {
    browserName: 'chromium',
    baseURL: 'http://127.0.0.1:4178',
    viewport: { width: 1440, height: 1000 },
    permissions: ['geolocation'],
    geolocation: { latitude: 13.6217, longitude: 123.1942, accuracy: 15 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4178 --strictPort',
    url: 'http://127.0.0.1:4178',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
