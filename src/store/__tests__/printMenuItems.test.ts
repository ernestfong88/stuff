import { describe, expect, it } from 'vitest';
import { PRINT_GROUPS } from '../../domain/printing';
import { printMenuItems, printOptions } from '../printing';

describe('print menu items', () => {
  it('lists each recipe on the tablet menu once, in print group order', () => {
    const rows = printMenuItems();
    expect(rows.length).toBeGreaterThan(0);
    const keys = rows.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
    const groups = rows.map((r) => PRINT_GROUPS.indexOf(r.group));
    expect([...groups].sort((a, b) => a - b)).toEqual(groups);
    // Every recipe a printer can pick is a row.
    const recipeKeys = new Set(rows.filter((r) => r.recipeId).map((r) => r.recipeId));
    for (const o of printOptions().filter((o) => o.kind === 'recipe')) expect(recipeKeys.has(o.key)).toBe(true);
  });
});
