import { expect, type BrowserContext, type Page } from '@playwright/test';

/** Pin the demo clock to a dinner service so every run sees the same day. */
export const at = (hash: string) => `/?clock=17:45${hash}`;

/** Open a surface in a new tab of the shared context, failing the test on page errors. */
export async function open(ctx: BrowserContext, hash: string): Promise<Page> {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => {
    throw e;
  });
  await page.goto(at(hash));
  return page;
}

/** Start from the seeded demo: clear everything the app saved. */
export async function freshDemo(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith('kisco')) localStorage.removeItem(k);
  });
  await page.reload();
}

/** A ticket or card on a kitchen or server screen, by its text. */
export function cardWith(page: Page, ...texts: Array<string | RegExp>) {
  let loc = page.locator('article, section, [class*="ticket" i], [class*="card" i]');
  for (const t of texts) loc = loc.filter({ hasText: t });
  return loc.first();
}

export async function bodyText(page: Page): Promise<string> {
  return (await page.locator('body').innerText()).replace(/\s+/g, ' ');
}

export { expect };
