import { test } from '@playwright/test';
import { at, expect } from './helpers';

const SURFACES = ['server', 'manager', 'host', 'bar', 'pud', 'cook', 'expo', 'prep', 'assocphone', 'kiosk', 'display', 'backoffice'];

for (const mode of SURFACES) {
  test(`${mode} opens without errors and fits the screen`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto(at(`#/${mode}`));
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#root')).not.toBeEmpty();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow, 'horizontal page scroll').toBe(false);
    expect(errors).toEqual([]);
  });
}
