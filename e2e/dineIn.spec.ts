import { test } from '@playwright/test';
import { bodyText, cardWith, expect, freshDemo, open } from './helpers';

test('a check travels from the server tablet to the kitchen, expo, and back office', async ({ context }) => {
  const server = await open(context, '#/server');
  await freshDemo(server);
  const cook = await open(context, '#/cook');
  const expo = await open(context, '#/expo');

  // Server: new check at EG 6 for Walter, Peach Chicken, send.
  await server.bringToFront();
  await server.goto('/?clock=17:45#/server/new');
  await server.getByText('EG 6', { exact: true }).first().click();
  await server.getByText('Walter Okonkwo').first().click();
  await server.getByRole('button', { name: 'Peach Chicken' }).first().click();
  await server.locator('button', { hasText: /Send/ }).last().click();

  // Cook sees the ticket and bumps it.
  await cook.bringToFront();
  const ticket = cardWith(cook, 'EG 6', /WALTER OKONKWO/i);
  await expect(ticket).toBeVisible();
  await ticket.getByRole('button', { name: /BUMP TICKET/i }).click();

  // Expo sees it ready and runs the last course.
  await expo.bringToFront();
  const expoTicket = cardWith(expo, 'EG 6', 'Walter');
  await expect(expoTicket).toContainText('Ready');
  await expoTicket.getByRole('button', { name: /^Run course 2\?$/ }).click();
  await expect(cardWith(expo, 'EG 6', 'Walter')).toHaveCount(0);

  // Server: the table is eating; close it to Walter's account.
  await server.bringToFront();
  await server.goto('/?clock=17:45#/server/mine');
  await expect(server.getByRole('region', { name: 'Eating' })).toContainText('EG 6');
  await server.getByRole('button', { name: 'Open EG 6, Walter' }).click();
  await server.getByRole('button', { name: /Close & charge/ }).click();
  await expect(server.getByText('Charged to Walter\'s resident account').first()).toBeVisible();
  await server.getByRole('button', { name: /Charge \$28\.00 & close/ }).click();
  await expect(server).toHaveURL(/#\/server\/mine/);

  // Back office: order history and the apartment charge to approve.
  const bo = await open(context, '#/backoffice/orders');
  await expect.poll(() => bodyText(bo)).toContain('Walter Okonkwo');
  await bo.goto('/?clock=17:45#/backoffice/chargeReview');
  await expect(bo.getByRole('row').filter({ hasText: 'Walter Okonkwo' }).filter({ hasText: '$28' })).toBeVisible();
});
