const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests/layout',
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4175', headless: true },
  webServer: { command: 'npm start', url: 'http://127.0.0.1:4175', reuseExistingServer: !process.env.CI },
});
