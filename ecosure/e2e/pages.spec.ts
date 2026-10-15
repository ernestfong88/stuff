import { expect, test } from '@playwright/test';

test('opens on the dashboard and filters by region', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'EcoSure Food Safety Dashboard' })).toBeVisible();
  await expect(page.locator('.dhl')).toContainText('issues');
  const chal = page.locator('.chalrow');
  await expect(chal).toHaveCount(3);
  await expect(chal.first()).toContainText('issues');
  await expect(chal.first()).toContainText('Trend');
  await expect(chal.first()).toContainText('Next quarter CD focus');
  await chal.first().locator('summary').click();
  await expect(chal.first()).toContainText('What the CD should check');
  await expect(chal.first().locator('.chdid li').first()).toContainText('Communities');
  await expect(chal.first().locator('.tpct')).toContainText('% of communities');
  const pest = page.locator('.dpest');
  await expect(pest.locator('[data-act="pest:activity"]')).toHaveAttribute('aria-pressed', 'true');
  await pest.locator('.prow summary').first().click();
  await expect(pest.locator('.prow').first()).toContainText('Remediated:');
  await expect(pest.locator('.prow .obs').first()).not.toContainText('...');
  await pest.locator('[data-act="pest:prevention"]').click();
  await expect(pest.locator('[data-act="pest:prevention"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#navMain button')).toHaveCount(1);
  await expect(page.locator('#morefold')).not.toHaveAttribute('open', '');
  await page.locator('#navOpen').click();
  await page.locator('#morefold > summary').click();
  await expect(page.locator('#navMore button')).toHaveCount(2);
  await expect(page.locator('.dhero > .dbig > *')).toHaveCount(4);
  await expect(page.locator('.dpanel .theme-hm tbody tr')).toHaveCount(5);
  const ident = page.locator('.dhero > .dbig > *').first();
  const before = await ident.textContent();
  const line = await page.locator('.dwin .dhl').textContent();
  await expect(page.locator('.dpest')).toContainText('Pest activity');
  await page.locator('.dsel > summary').click();
  await page.locator('[data-act="sel:none"]').click();
  await page.locator('input[data-selreg="Mountain"]').check();
  await expect(page.locator('.dsel > summary b')).toHaveText('Mountain region');
  await expect(page.locator('.dwin .dhl')).not.toHaveText(line!);
  await expect(ident).not.toHaveText(before!);
  await page.locator('[data-act="sel:done"]').click();
  await expect(page.locator('.dselpanel')).toBeHidden();
  await page.reload();
  await expect(page.locator('.dsel > summary b')).toHaveText('Mountain region');
  await page.locator('.dsel > summary').click();
  await page.locator('[data-act="sel:all"]').click();
  await expect(page.locator('.dsel > summary b')).toContainText('All communities');
  await page.locator('[data-act="sel:done"]').click();
  await page.locator('.dpanel .theme-hm tbody tr').first().locator('.lab button').click();
  await expect(page.locator('.dhl')).toContainText('resolved');
  await page.goto('/');
  await expect(page.locator('.dhl')).toContainText('remediated');
});

test('the dashboard stays short and opens a community snapshot', async ({ page }) => {
  await page.goto('/#home');
  await expect(page.getByRole('heading', { name: 'EcoSure Food Safety Dashboard' })).toBeVisible();
  await expect(page.locator('.xcard')).toHaveCount(0);
  await expect(page.locator('.dmix')).toHaveCount(0);
  await expect(page.locator('.dhl')).toContainText('remediated');
  await expect(page.locator('#navComm .captag').first()).toBeAttached();
  await page.locator('.dpanel .theme-hm tbody tr').first().locator('.lab button').click();
  await expect(page.locator('.dhl')).toContainText('issues');
  await expect(page.locator('.dtop3 li')).toHaveCount(3);
  await page.locator('.dmixlab [data-crit="Critical"]').click();
  await expect(page.locator('[data-fold="findings"]')).toHaveAttribute('open', '');
  await expect(page.locator('.finds .find').first()).toContainText('Critical');
});



test('dashboard links open Findings filtered to what was clicked, for the picked communities', async ({ page }) => {
  await page.goto('/');
  await page.locator('.dsel > summary').click();
  await page.locator('[data-act="sel:none"]').click();
  await page.locator('input[data-selreg="Mountain"]').check();
  await page.locator('[data-act="sel:done"]').click();
  const num = async (sel: string) => Number((await page.locator(sel).first().locator('b').first().textContent())!.trim());
  const count = async () => Number((await page.locator('section.block h3 .sm').first().textContent())!.match(/^(\d+)/)![1]);
  const back = async () => { await page.locator('.backbtn').click(); await expect(page.locator('.dhero')).toBeVisible(); };
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

  const risk = Number((await page.locator('.dhero > .dbig > :nth-child(3) b').textContent())!.split('/')[1]);
  await page.locator('.dhero > .dbig > :nth-child(3)').click();
  await expect(page.locator('.dmit')).toBeVisible();
  await page.locator('.dmit [data-go="findings"]').click();
  await expect(page.locator('#f-crit')).toHaveValue('Critical');
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

test('a high-risk finding made safe on site shows as immediate risk remediated', async ({ page }) => {
  await page.goto('/#c-park-terrace');
  await expect(page.locator('.capbox.mit')).toContainText('Immediate risk remediated');
  await page.goto('/');
  await expect(page.locator('.dhero > .dbig > :nth-child(3)')).toContainText('identified and remediated');
  await expect(page.locator('.dhero > .dbig > :nth-child(3) .mitg')).toContainText('waiting for a full solution');
  await expect(page.locator('.dhl')).not.toContainText('waiting');
});

test('the dashboard round picker lists upcoming rounds and shows an empty state for them', async ({ page }) => {
  await page.goto('/');
  const sel = page.locator('select[data-dround]');
  await expect(sel.locator('option')).toContainText(['All rounds', 'Q3 2026', 'Q4 2026 (upcoming)', 'Q1 2027 (upcoming)', 'Q2 2027 (upcoming)', 'Q3 2027 (upcoming)', 'Q4 2027 (upcoming)']);
  await expect(page.locator('.dwin .dhl')).toHaveText(/^In \d+ days, \d+ audits conducted, \d+ out of \d+ issues logged and remediated\.$/);
  await expect(page.locator('.crumb')).toHaveCount(0);
  await sel.selectOption('Q1 2027');
  await expect(page.locator('.dfuture')).toContainText('no EcoSure audits yet');
  await expect(page.locator('.dhero')).toHaveCount(0);
  await page.locator('.dfuture [data-round="all"]').click();
  await expect(page.locator('.dhero')).toHaveCount(1);
});

test('every page has a back button to the dashboard', async ({ page }) => {
  for (const r of ['findings', 'priorities', 'trends', 'import', 'settings', 'c-park-terrace']) {
    await page.goto('/#' + r);
    await page.locator('.backbtn').click();
    await expect(page.getByRole('heading', { name: 'EcoSure Food Safety Dashboard' })).toBeVisible();
  }
  await expect(page.locator('.backbtn')).toHaveCount(0);
});

test('Findings opens with the issues ranked, and an issue filters the list', async ({ page }) => {
  await page.goto('/#priorities');
  await expect(page.getByRole('heading', { name: 'Findings and photos' })).toBeVisible();
  const rows = page.locator('table.prio tbody tr');
  await expect(rows).toHaveCount(5);
  const name = (await rows.first().locator('[data-act^="std:"]').textContent())!.trim();
  await rows.first().locator('[data-act^="std:"]').click();
  await expect(page.locator('section.block h3').first()).toContainText(name);
  await expect(page.locator('table.prio')).toHaveCount(0);
});

test('the menu starts hidden on larger screens and opens on demand', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await expect(page.locator('#side')).toBeHidden();
  await page.locator('#navOpen').click();
  await expect(page.locator('#side')).toBeVisible();
  await page.locator('#navClose').click();
  await expect(page.locator('#side')).toBeHidden();
});

test('Trends shows average score, filters and future quarters', async ({ page }) => {
  await page.goto('/#trends');
  await expect(page.locator('h2.page')).toHaveText('Average score');
  await expect(page.locator('.fbtn.future', { hasText: 'Q4 2027' })).toBeVisible();
  await page.locator('select[data-trend="region"]').selectOption('Mountain');
  await expect(page.locator('.panel h3', { hasText: 'Average score by community' })).toBeVisible();
});
