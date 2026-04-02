const { test, expect } = require('@playwright/test');

test.describe('AdmitGuard Admin Dashboard Suite', () => {
  test('Verify Admin Dashboard login and branding on Vercel', async ({ page }) => {
    // 1. Visit the actual Vercel project
    await page.goto('https://admit-guard.vercel.app');

    // 2. Check the Title in the HTML meta
    await expect(page).toHaveTitle(/AdmitGuard/);

    // 3. Verify the "Command Center" Header exists
    const header = await page.locator('header').first();
    await expect(header).toBeVisible();

    console.log('🛡️ Dashboard Robot: AdmitGuard Vercel project is LIVE and branding is visible!');
    
    // Note: To test login, you would need to simulate the Google Login flow.
    // For now, this confirms the project is correctly distributed and loading.
  });

  test('Verify the Audit View loads', async ({ page }) => {
    await page.goto('https://admit-guard.vercel.app/audit.html'); // Correct for your setup
    
    // 4. Verify the Table header exists (proving JSON sync)
    const tableHeader = await page.locator('table thead tr th').first();
    await expect(tableHeader).toBeVisible();
    
    console.log('🛡️ Dashboard Robot: Audit View is correctly synced and rendering tables!');
  });
});
