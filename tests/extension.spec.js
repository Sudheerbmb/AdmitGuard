const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test.describe('AdmitGuard Extension Suite', () => {
  test('Verify Extension Popup loads and displays branding', async () => {
    // 1. Path to your manifest.json (Root in this project)
    const pathToExtension = path.join(__dirname, '../');

    // 2. Launch a "Robot" Chrome with AdmitGuard installed
    const browserContext = await chromium.launchPersistentContext('', {
      headless: false, // Extensions only work in windowed mode
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });

    const page = await browserContext.newPage();
    
    // 3. Open the Extension's popup page directly using its relative path
    // In many setups, extension URLs are chrome-extension://[id]/popup.html
    // For a simple local test, we can check if it exists or even if we can browse to its file.
    await page.goto('file://' + path.join(pathToExtension, 'popup.html'));

    // 4. Check if the Title "AdmitGuard" exists in the popup
    const title = await page.textContent('h1');
    expect(title).toContain('AdmitGuard');

    console.log('🛡️ Extension Robot: Popup loaded and branding verified!');

    await browserContext.close();
  });
});
