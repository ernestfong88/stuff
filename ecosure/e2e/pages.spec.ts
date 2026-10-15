import { expect, test } from '@playwright/test';

test('opens on the dashboard and filters by region', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'EcoSure Food Safety Dashboard' })).toBeVisible();
  await expect(page.locator('.dhl')).toContainText('issues');
  const chal = page.locator('.chalrow');
  await expect(chal).toHaveCount(3);
  await expect(chal.first().locator('summary')).toContainText('issues');
  await chal.first().locator('summary').click();
  await expect(chal.first().locator('.chdid li').first()).toContainText('kitchen');
  await expect(chal.first().locator('.caution')).toContainText('Our SMEs will focus on');
  const pest = page.locator('.dpest');
  await expect(pest.locator('[data-act="pest:activity"]')).toHaveAttribute('aria-pressed', 'true');
  await pest.locator('.prow summary').first().click();
  await expect(pest.locator('.prow').first()).toContainText('Remediated:');
  await expect(pest.locator('.prow .obs').first()).not.toContainText('...');
  await pest.locator('[data-act="pest:prevention"]').click();
  await expect(pest.locator('[data-act="pest:prevention"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#navMain button')).toHaveCount(1);
  await expect(page.locator('#morefold')).not.toHaveAttribute('open', '');
  await page.locator('#morefold > summary').click();
  await expect(page.locator('#navMore button')).toHaveCount(4);
  await expect(page.locator('.dhero > .dbig > *')).toHaveCount(4);
  await expect(page.locator('.dfocus tbody tr')).toHaveCount(5);
  const ident = page.locator('.dhero > .dbig > *').first();
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
  await expect(page.locator('.dhl')).toContainText('resolved');
  await page.goto('/');
  await expect(page.locator('.dhl')).toContainText('resolved');
});

test('the dashboard stays short and opens a community snapshot', async ({ page }) => {
  await page.goto('/#home');
  await expect(page.getByRole('heading', { name: 'EcoSure Food Safety Dashboard' })).toBeVisible();
  await expect(page.locator('.xcard')).toHaveCount(0);
  await expect(page.locator('.dmix')).toHaveCount(0);
  await expect(page.locator('.dhl')).toContainText('resolved');
  await expect(page.locator('#navComm .captag').first()).toBeAttached();
  await page.locator('.dfocus tbody tr').first().click();
  await expect(page.locator('.dhl')).toContainText('issues');
  await expect(page.locator('.dtop3 li')).toHaveCount(3);
  await page.locator('.dmixlab [data-crit="Critical"]').click();
  await expect(page.locator('[data-fold="findings"]')).toHaveAttribute('open', '');
  await expect(page.locator('.finds .find').first()).toContainText('Critical');
});


test('playbook deep link highlights the standard', async ({ page }) => {
  await page.goto('/#playbook.cold-holding-at-41-f-or-below');
  await expect(page.locator('#p-cold-holding-at-41-f-or-below')).toHaveClass(/hl/);
});

test('dashboard links open Findings filtered to what was clicked, for the picked communities', async ({ page }) => {
  await page.goto('/');
  await page.locator('.dsel > summary').click();
  await page.locator('[data-act="sel:none"]').click();
  await page.locator('input[data-selreg="Mountain"]').check();
  await page.locator('[data-act="sel:done"]').click();
  const num = async (sel: string) => Number((await page.locator(sel).first().locator('b').first().textContent())!.trim());
  const count = async () => Number((await page.locator('section.block h3 .sm').first().textContent())!.match(/^(\d+)/)![1]);
  const back = async () => { await page.locator('#navMain [data-go="dashboard"]').click(); await expect(page.locator('.dhero')).toBeVisible(); };
  const chip = page.locator('[data-act="clear-comms"]');

  const found = await num('.dhero > .dbig > :nth-child(1)');
  await page.locator('.dhero > .dbig > :nth-child(1)').click();
  await expect(chip).toContainText('Mountain region');
  expect(await count()).toBe(found);
  await back();

  const done = Number((await page.locator('.dhero > .dbig > :nth-child(2) .ds').textContent())!.match(/^(\d+)/)![1]);
  await page.locator('.dhero > .dbig > :nth-child(2)').click();
  await expect(page.locator('#f-cap')).toHaveValue('closed');
  expect(await count()).toBe(done);
  await back();

  const risk = await num('.dhero > .dbig > :nth-child(3)');
  await page.locator('.dhero > .dbig > :nth-child(3)').click();
  await expect(page.locator('#f-crit')).toHaveValue('Critical');
  await expect(page.locator('#f-cap')).toHaveValue('open');
  expect(await count()).toBe(risk);
  await back();

  const chal = page.locator('.chalrow').first();
  const n = Number(await chal.locator('.cn b').textContent());
  await chal.locator('summary').click();
  await chal.locator('[data-act^="std-photos:"]').click();
  await expect(chip).toBeVisible();
  expect(await count()).toBe(n);
  await back();

  await page.locator('.dpest [data-go="findings"][data-section]').first().click();
  await expect(page.locator('#f-section')).toHaveValue('Insects/Rodents/Animals');
  await expect(chip).toBeVisible();
  await chip.click();
  await expect(chip).toHaveCount(0);
});
