import { expect, test } from '@playwright/test';

test('opens on the dashboard and filters by region', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'EcoSure Food Safety Dashboard' })).toBeVisible();
  await expect(page.locator('.dhl')).toContainText('violations');
  await expect(page.locator('.dtop3 li')).toHaveCount(3);
  await expect(page.locator('.dtop3 .did').first()).not.toBeEmpty();
  await expect(page.locator('.dbig > *')).toHaveCount(3);
  await expect(page.locator('.dmixlab button')).toHaveCount(3);
  await expect(page.locator('.dfocus tbody tr')).toHaveCount(5);
  const ident = page.locator('.dbig > *').first();
  const before = await ident.textContent();
  await expect(page.locator('.dpest')).toContainText('pest activity');
  await page.locator('.dsel > summary').click();
  await page.locator('[data-act="sel:none"]').click();
  await page.locator('input[data-selreg="Mountain"]').check();
  await expect(page.locator('.dsel > summary b')).toHaveText('Mountain region');
  await expect(page.locator('.dhl')).toContainText('in the Mountain region');
  await expect(ident).not.toHaveText(before!);
  await page.locator('[data-act="sel:done"]').click();
  await expect(page.locator('.dselpanel')).toBeHidden();
  await page.reload();
  await expect(page.locator('.dsel > summary b')).toHaveText('Mountain region');
  await page.locator('.dsel > summary').click();
  await page.locator('[data-act="sel:all"]').click();
  await expect(page.locator('.dsel > summary b')).toContainText('All communities');
  await page.locator('[data-act="sel:done"]').click();
  await page.locator('.dfocus tbody tr').first().click();
  await expect(page.getByRole('heading', { name: 'Talking points' })).toBeVisible();
  await page.goto('/');
  await expect(page.locator('.dhl')).toContainText('remediated');
});

test('the dashboard keeps the briefing: issues with photos, next steps, talking points', async ({ page }) => {
  await page.goto('/#home');
  await expect(page.getByRole('heading', { name: 'EcoSure Food Safety Dashboard' })).toBeVisible();
  const fix = page.locator('.xcard', { hasText: 'Top 5 issues' }).locator('.xrow');
  await expect(fix).toHaveCount(5);
  await expect(fix.first().locator('summary img')).toHaveAttribute('src', /^data:image/);
  await fix.first().locator('summary').click();
  await expect(fix.first()).toContainText('The fix');
  await expect(page.locator('.steps li')).toHaveCount(3);
  await expect(page.locator('#navComm .captag').first()).toBeAttached();
  await page.locator('.dfocus tbody tr').first().click();
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
