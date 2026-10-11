import { expect, test } from '@playwright/test';

test('role picker opens the matching home and remembers it', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'EcoSure Audit Review', level: 2 })).toBeVisible();
  await page.locator('[data-role="leadership"]').click();
  await expect(page.getByRole('heading', { name: 'Food safety at a glance' })).toBeVisible();
  await expect(page.locator('.focus')).toHaveCount(5);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Food safety at a glance' })).toBeVisible();

  await page.locator('[data-act="role-change"]').click();
  await page.locator('[data-role="regional"]').click();
  await expect(page.locator('.vcard').first()).toBeVisible();

  await page.locator('[data-act="role-change"]').click();
  await page.locator('[data-role="community"]').click();
  await page.selectOption('#my-community', 'balfour-riverfront');
  await expect(page.getByRole('heading', { name: 'Fix first' })).toBeVisible();
});

test('a community submits a self-audit and readiness shows up', async ({ page }) => {
  await page.goto('/#self-drake-terrace');
  await expect(page.locator('.citem').first()).toBeVisible();
  await page.locator('[data-act="self-pass-rest"]').click();
  await page.locator('.citem', { hasText: 'Hood system clean/in repair' }).locator('.seg.fail').click();
  await page.locator('input[data-note="Hood system clean/in repair"]').fill('Filters greasy; cleaned today');
  await page.fill('#sa-by', 'Test Person');
  await page.locator('[data-act="self-submit"]').click();
  await expect(page.locator('h2.page')).toHaveText('Drake Terrace');
  await expect(page.locator('.tile', { hasText: 'Self-audit readiness' })).toContainText('%');
  await page.evaluate(() => (location.hash = 'self'));
  await expect(page.locator('tr', { hasText: 'Drake Terrace' })).toContainText('Self-audit current');
});

test('playbook deep link highlights the standard', async ({ page }) => {
  await page.goto('/#playbook.cold-holding-at-41-f-or-below');
  await expect(page.locator('#p-cold-holding-at-41-f-or-below')).toHaveClass(/hl/);
});
