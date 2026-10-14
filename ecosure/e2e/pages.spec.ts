import { expect, test } from '@playwright/test';

test('opens on the dashboard and filters by region', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'EcoSure Food Safety Dashboard' })).toBeVisible();
  await expect(page.locator('.dhl')).toContainText('violations');
  await expect(page.locator('.chalcard')).toHaveCount(3);
  await expect(page.locator('.chalcard .chdid li').first()).toContainText('kitchen');
  await expect(page.locator('.chalcard .caution li').first()).not.toBeEmpty();
  const pest = page.locator('.dpest');
  await expect(pest.locator('[data-act="pest:activity"]')).toHaveAttribute('aria-pressed', 'true');
  await pest.locator('.prow summary').first().click();
  await expect(pest.locator('.prow').first()).toContainText('Remediated:');
  await pest.locator('[data-act="pest:prevention"]').click();
  await expect(pest.locator('[data-act="pest:prevention"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#navMain button')).toHaveCount(1);
  await expect(page.locator('#navMore')).not.toContainText('Self-audits');
  await expect(page.locator('.dbig > *')).toHaveCount(3);
  await expect(page.locator('.dmixlab button')).toHaveCount(3);
  await expect(page.locator('.dfocus tbody tr')).toHaveCount(5);
  const ident = page.locator('.dbig > *').first();
  const before = await ident.textContent();
  await expect(page.locator('.dpest')).toContainText('Pest activity');
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
  await expect(page.locator('.dhl')).toContainText('The team has remediated');
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
  await expect(page.locator('.dhl')).toContainText('violations');
  await expect(page.locator('.dtop3 li')).toHaveCount(3);
  await page.locator('.dmixlab [data-crit="Critical"]').click();
  await expect(page.locator('[data-fold="findings"]')).toHaveAttribute('open', '');
  await expect(page.locator('.finds .find').first()).toContainText('Critical');
});


test('playbook deep link highlights the standard', async ({ page }) => {
  await page.goto('/#playbook.cold-holding-at-41-f-or-below');
  await expect(page.locator('#p-cold-holding-at-41-f-or-below')).toHaveClass(/hl/);
});
