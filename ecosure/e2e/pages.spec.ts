import { expect, test } from '@playwright/test';

test('opens on the dashboard and filters by region', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'EcoSure Food Safety Dashboard' })).toBeVisible();
  await expect(page.locator('.dhl')).toContainText('food safety violations');
  await expect(page.locator('.dimpact tbody tr')).toHaveCount(4);
  await expect(page.locator('.dcomm tbody tr')).toHaveCount(5);
  await page.locator('[data-act="dsort:rate"]').click();
  await expect(page.locator('[data-act="dsort:rate"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-act="expand:dash-comm"]').click();
  expect(await page.locator('.dcomm tbody tr').count()).toBeGreaterThan(5);
  await expect(page.locator('.dkpi')).toHaveCount(4);
  const audited = page.locator('.dkpi', { hasText: 'Communities audited' });
  const before = await audited.textContent();
  await page.locator('.dfilters [data-act="region:Mountain"]').click();
  await expect(page.locator('.dfilters [data-act="region:Mountain"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(audited).not.toHaveText(before!);
  await page.locator('.dcomm tbody tr').first().click();
  await expect(page.getByRole('heading', { name: 'Talking points' })).toBeVisible();
  await page.goto('/');
  await page.locator('.dhead [data-go="home"]').click();
  await expect(page.getByRole('heading', { name: 'Food safety briefing' })).toBeVisible();
});

test('the executive briefing has photos and talking points', async ({ page }) => {
  await page.goto('/#home');
  await expect(page.getByRole('heading', { name: 'Food safety briefing' })).toBeVisible();
  await expect(page.locator('.bottomline li')).toHaveCount(3);
  const fix = page.locator('.xcard', { hasText: 'What to fix' }).locator('.xrow');
  await expect(fix).toHaveCount(5);
  await expect(fix.first().locator('summary img')).toHaveAttribute('src', /^data:image/);
  await fix.first().locator('summary').click();
  await expect(fix.first()).toContainText('The fix');
  const help = page.locator('.xcard', { hasText: 'Who needs help' }).locator('.xrow');
  await expect(help).toHaveCount(5);
  await page.locator('[data-act="expand:brief-help"]').click();
  await expect(fix.first()).toHaveAttribute('open', '');
  await expect(page.locator('.steps li')).toHaveCount(3);
  await expect(page.locator('.xkpi', { hasText: 'CAPs missing' })).toBeVisible();
  await expect(page.locator('#navComm .captag').first()).toBeAttached();
  await expect(page.locator('.xcard', { hasText: 'By region' }).locator('.xrow')).toHaveCount(4);
  const impact = page.locator('.impact');
  await expect(impact.locator('.ihead')).toContainText('infractions found');
  await impact.locator('[data-act="sev:Critical"]').first().click();
  await expect(impact.locator('.ihead')).toContainText('critical infractions found');
  await expect(impact.locator('.sevtile')).toHaveCount(3);
  await help.first().locator('summary').click();
  await help.first().locator('.btn').click();
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
  // Current self-audits sort to the end, past the top 5.
  await expect(page.locator('tr', { hasText: 'Drake Terrace' })).toHaveCount(0);
  await page.locator('[data-act="expand:self"]').click();
  await expect(page.locator('tr', { hasText: 'Drake Terrace' })).toContainText('Self-audit current');
});

test('playbook deep link highlights the standard', async ({ page }) => {
  await page.goto('/#playbook.cold-holding-at-41-f-or-below');
  await expect(page.locator('#p-cold-holding-at-41-f-or-below')).toHaveClass(/hl/);
});
