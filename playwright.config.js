const { defineConfig, devices } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests/browser',
  timeout: 30000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
    { name: 'edge', use: { ...devices['Desktop Chrome'], channel: 'msedge' } },
  ],
  webServer: {
    command: 'python3 -m http.server 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 15000
  }
});
