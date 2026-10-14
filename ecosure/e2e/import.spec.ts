import { expect, test } from '@playwright/test';

test('opens on the portfolio with the carried-over audits', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'EcoSure Food Safety Dashboard' })).toBeVisible();
  await expect(page.locator('#navComm button')).toHaveCount(30);
  for (const r of ['dashboard', 'priorities', 'playbook', 'findings', 'trends', 'import', 'settings', 'c-balfour-riverfront']) {
    await page.evaluate((h) => (location.hash = h), r);
    await expect(page.locator('h2.page')).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('imports a report and its CAP, then shows them on the community page', async ({ page }) => {
  await page.goto('/#import');
  await page.setInputFiles('#file', ['tests/fixtures/sample-report.pdf', 'tests/fixtures/sample-cap.pdf']);
  await expect(page.locator('.qi .spin')).toHaveCount(0, { timeout: 60_000 });
  const report = page.locator('.qi', { hasText: 'sample-report.pdf' });
  await expect(report).toContainText('Score 91');
  await expect(report).toContainText('3 findings');
  await expect(report).toContainText('3 photos');
  await expect(page.locator('.qi', { hasText: 'sample-cap.pdf' })).toContainText('2 items');
  await page.getByRole('button', { name: /Save all/ }).click();
  await expect(page.locator('.qi .t-good')).toHaveCount(2, { timeout: 60_000 });

  await page.evaluate(() => (location.hash = 'c-sample-terrace'));
  await expect(page.locator('h2.page')).toHaveText('Sample Terrace');
  await expect(page.locator('.find')).toHaveCount(3);
  await expect(page.locator('.find', { hasText: 'Cold food held too warm' })).toContainText('Reach-in gasket replaced');
  await expect(page.locator('.find .thumbs img')).toHaveCount(3);

  // The CAP is still Pending, so nothing is remediated yet and the challenges show it in progress.
  await expect(page.locator('.dhl')).toContainText('remediated 0%');
  await expect(page.locator('.dtop3 .chip', { hasText: 'In progress' }).first()).toBeVisible();
});

test('rejects a PDF that is not from EcoSure', async ({ page }) => {
  await page.goto('/#import');
  await page.setInputFiles('#file', { name: 'menu.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF') });
  await expect(page.locator('.qi', { hasText: 'menu.pdf' })).toContainText('Not imported', { timeout: 30_000 });
});
