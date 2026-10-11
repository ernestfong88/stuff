import { expect, test } from '@playwright/test';

test('opens on a plain-language briefing with photos and talking points', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'EcoSure food safety briefing' })).toBeVisible();
  await expect(page.locator('.issue')).toHaveCount(3);
  await expect(page.locator('.issue img').first()).toHaveAttribute('src', /^data:image/);
  await expect(page.locator('.help li').first()).toBeVisible();
  await page.locator('.help li .linkbtn').first().click();
  await expect(page.getByRole('heading', { name: 'Talking points' })).toBeVisible();
  await expect(page.locator('.talk li').first()).toContainText('scored');
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
