'use strict';

const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './test/e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4789',
    headless: true,
    trace: 'retain-on-failure',
  },
  webServer: {
    command:
      'ASKUSER_OPEN_BROWSER=0 ASKUSER_PORT=4789 XDG_CONFIG_HOME=test-results/playwright-config node server/server.js',
    url: 'http://127.0.0.1:4789/health',
    timeout: 30_000,
    reuseExistingServer: false,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
