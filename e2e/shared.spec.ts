import { test } from '@playwright/test';
import { bodyText, expect, freshDemo, open } from './helpers';

test('86 from the manager tablet reaches the specials display', async ({ context }) => {
  const manager = await open(context, '#/manager/86');
  await freshDemo(manager);
  const display = await open(context, '#/display');
  await expect.poll(() => bodyText(display)).toContain('Peach Glazed Chicken Breast');

  await manager.bringToFront();
  await manager.locator('div, button').filter({ hasText: /^Peach Chicken/ }).getByRole('button', { name: 'Mark 86' }).first().click();

  await display.bringToFront();
  // The display rotates every few seconds; the 86'd special never comes back.
  for (let i = 0; i < 4; i++) {
    await display.waitForTimeout(4200);
    expect(await bodyText(display)).not.toContain('Peach Glazed Chicken Breast');
  }
});

test('reset demo data puts the seeded service back on every screen', async ({ context }) => {
  const server = await open(context, '#/server');
  await freshDemo(server);
  const cook = await open(context, '#/cook');
  await expect.poll(() => bodyText(cook)).toContain('SQ 1');

  await server.bringToFront();
  await server.getByTitle(/^Mode: /).click();
  await server.getByRole('menuitem', { name: 'Clear all tickets' }).click();
  await server.getByRole('dialog').getByRole('button', { name: 'Clear all tickets' }).click();
  await cook.bringToFront();
  await expect.poll(() => bodyText(cook)).not.toContain('SQ 1');

  await server.bringToFront();
  await server.getByTitle(/^Mode: /).click();
  await server.getByRole('menuitem', { name: 'Reset demo data' }).click();
  await server.getByRole('dialog').getByRole('button', { name: 'Reset demo data' }).click();
  await cook.bringToFront();
  await expect.poll(() => bodyText(cook)).toContain('SQ 1');
});
