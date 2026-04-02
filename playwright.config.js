// playwright.config.js
module.exports = {
  testDir: './tests',
  timeout: 45 * 1000,
  expect: { timeout: 10000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    actionTimeout: 0,
    trace: 'on-first-retry',
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: 'AdmitGuard Extension',
      use: {
        browserName: 'chromium',
        // In this project, the Extension files (manifest.json, popup.html) are in the ROOT
        // We'll pass the path to the extension in the actual test to load it properly
      },
    }
  ],
};
