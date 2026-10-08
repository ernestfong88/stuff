import { test } from '@playwright/test';
import { bodyText, cardWith, expect, freshDemo, open } from './helpers';

test('a check travels from the server tablet to the kitchen, expo, and back office', async ({ context }) => {
  const server = await open(context, '#/server');
  await freshDemo(server);
  const cook = await open(context, '#/cook');
  const expo = await open(context, '#/expo');

  // Server: new check at EG 11 for Harold, Peach Chicken, send.
  await server.bringToFront();
  await server.goto('/?clock=17:45#/server/new');
  await server.getByText('EG 11', { exact: true }).first().click();
  await server.getByRole('searchbox', { name: 'Type a name or apartment number' }).fill('Harold');
  await server.getByText('Harold Yeung').first().click();
  await server.getByRole('tab', { name: 'Specials' }).click();
  await server.getByRole('button', { name: 'Peach Chicken' }).first().click();
  await server.locator('button', { hasText: /Send/ }).last().click();

  // Cook sees the ticket and bumps it.
  await cook.bringToFront();
  const ticket = cardWith(cook, 'EG 11', /HAROLD YEUNG/i);
  await expect(ticket).toBeVisible();
  await ticket.getByRole('button', { name: /BUMP TICKET/i }).click();

  // Expo sees it ready and runs the last course.
  await expo.bringToFront();
  const expoTicket = cardWith(expo, 'EG 11', 'Harold');
  await expect(expoTicket).toContainText('Ready');
  await expoTicket.getByRole('button', { name: /^Run course 2\?$/ }).click();
  await expect(cardWith(expo, 'EG 11', 'Harold')).toHaveCount(0);

  // Server: the table is eating; close it to Harold's account.
  await server.bringToFront();
  await server.goto('/?clock=17:45#/server/mine');
  await expect(server.getByRole('region', { name: 'Eating' })).toContainText('EG 11');
  await server.getByRole('button', { name: 'Open EG 11, Harold' }).click();
  await server.getByRole('button', { name: /Close & charge/ }).click();
  await expect(server.getByText("Charged to Harold's resident account").first()).toBeVisible();
  await server.getByRole('button', { name: /Charge \$28\.00 & close/ }).click();
  await expect(server).toHaveURL(/#\/server\/mine/);

  // Back office: order history and the apartment charge to approve.
  const bo = await open(context, '#/backoffice/orders');
  await expect.poll(() => bodyText(bo)).toContain('Harold Yeung');
  await bo.goto('/?clock=17:45#/backoffice/chargeReview');
  await expect(bo.getByRole('row').filter({ hasText: 'Harold Yeung' }).filter({ hasText: '$28' })).toBeVisible();
});
