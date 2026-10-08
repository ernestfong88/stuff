import { describe, expect, it } from 'vitest';
import type { GridEntry, Recipe, VenueSchedule } from '../../../../store/menuEdits';
import { SEED } from '../data';
import { aiCheck, applyOps, undoOps } from '../model/aiReview';
import { guessCategory, guessProtein, guessSubcategory, normCategory, subOf } from '../model/categories';
import { cycleDayOn, DAY_MS, menuAnchor, menuState, quarterLabel, quarterMenuName, SEED_TODAY, seedShift, shiftDay, venuesAt } from '../../../../domain/menuCycle';
import { searchRecipes } from '../cycles/slotSearchModel';
import { groupDay, parseDays, sameWeekday, sideMatches } from '../model/dayGroup';
import { menuRows, quarterGaps } from '../model/menuList';
import { andList, esc, printContext, dailyMenuHtml, orderFormHtml } from '../model/menuPrint';
import { orphanPrices, setPrice } from '../model/pricing';
import { choiceWords, fraction, parseRecipeText, qtyUnit } from '../model/recipeDraft';
import { filterRecipes, inGroup, NO_FILTERS } from '../model/recipeFilter';
import { mentionScore, noteDish, popularity, recipeScore, type FeedbackEntry } from '../model/score';

const day = (iso: string) => new Date(iso + 'T12:00:00').getTime();

describe('cycle days', () => {
  it('counts from the Sunday of the start week and wraps around the cycle', () => {
    const start = day('2026-09-20'); // a Sunday
    expect(cycleDayOn(start, 35, day('2026-09-20'))).toBe(1);
    expect(cycleDayOn(start, 35, day('2026-10-07'))).toBe(18);
    expect(cycleDayOn(start, 35, day('2026-10-25'))).toBe(1);
    expect(cycleDayOn(start, 7, day('2026-09-19'))).toBe(7);
    // Weeks run Sunday to Saturday: a Wednesday start counts from its Sunday.
    expect(cycleDayOn(day('2026-09-23'), 35, day('2026-09-23'))).toBe(4);
    expect(cycleDayOn(null, 35, day('2026-10-07'))).toBeNull();
  });

  it('switches a venue to its scheduled menu once the date passes', () => {
    const v: VenueSchedule = { id: 'v1', name: 'Sequoia', menuId: 'm1', menuStartDt: day('2026-09-23'), active: true, upcoming: [{ menuId: 'm5', startDt: day('2026-11-30') }] };
    expect(venuesAt([v], day('2026-10-07'))[0].menuId).toBe('m1');
    const later = venuesAt([v], day('2026-12-01'))[0];
    expect(later.menuId).toBe('m5');
    expect(later.upcoming).toEqual([]);
  });

  it('works out a menu state from where it is served', () => {
    const venues: VenueSchedule[] = [{ id: 'v1', name: 'A', menuId: 'm1', menuStartDt: 0, active: true, upcoming: [{ menuId: 'm5', startDt: 0 }] }];
    const m = (id: string, status: 'draft' | 'active' | 'archived' = 'draft') => ({ id, name: id, kind: 'cycle' as const, quarter: 'Q4 2026', cycleLen: 35, status });
    expect(menuState(m('m1'), venues)).toBe('active');
    expect(menuState(m('m5'), venues)).toBe('scheduled');
    expect(menuState(m('m9'), venues)).toBe('draft');
    expect(menuState(m('m9', 'active'), venues)).toBe('archived');
  });

  it('dates a running menu from the lap of the cycle it is in', () => {
    const at = day('2026-10-07');
    const venues: VenueSchedule[] = [{ id: 'v1', name: 'A', menuId: 'm1', menuStartDt: day('2026-09-23'), active: true }];
    const a = menuAnchor({ id: 'm1', name: '', kind: 'cycle', quarter: '', cycleLen: 35, status: 'active' }, venues, 35, at)!;
    expect(a.live).toBe(true);
    expect(a.today).toBe(18);
    expect(a.start.getDate()).toBe(20);
    expect(a.start.getDay()).toBe(0);
  });

  it('names menus after their quarter', () => {
    expect(quarterLabel(2026 * 4 + 3)).toBe('Q4 2026');
    expect(quarterMenuName('Q1 2027', 'cycle')).toBe('VT Winter 2027');
    expect(quarterMenuName('Q3 2026', 'alc')).toBe('VT Summer 2026 À la Carte');
  });
});

describe('categories', () => {
  it('reads older category names', () => {
    expect(normCategory('Entrées')).toBe('Entrees');
    expect(normCategory('Beverage')).toBe('Drinks');
    expect(normCategory('Mystery')).toBe('Entrees');
  });
  it('guesses category, subcategory and protein from a name', () => {
    expect(guessCategory('Chocolate Mousse')).toBe('Desserts');
    expect(guessCategory('Clam Chowder')).toBe('Starters');
  });
  it('files cakes and pies as desserts, but not pancakes, crab cakes, pot pie or oatmeal', () => {
    expect(guessCategory('Lemon Ricotta Pancakes')).toBe('Entrees');
    expect(guessCategory('Maryland Crab Cakes')).toBe('Entrees');
    expect(guessCategory('Apple Pie Oatmeal')).toBe('Entrees');
    expect(guessCategory('Chicken Pot Pie')).toBe('Entrees');
    expect(guessCategory("Shepherd's Pie")).toBe('Entrees');
    expect(guessCategory('Belgian Waffles')).toBe('Entrees');
    expect(guessCategory('Carrot Cake')).toBe('Desserts');
    expect(guessCategory('Dutch Apple Pie')).toBe('Desserts');
    expect(guessCategory('Strawberry Shortcake')).toBe('Desserts');
    expect(guessCategory('Pumpkin Cheesecake')).toBe('Desserts');
    expect(guessSubcategory('Entrees', 'Reuben Sandwich')).toBe('Sandwiches');
    expect(guessSubcategory('Drinks', 'Iced Tea')).toBe('Coffee & Tea');
    expect(guessSubcategory('Drinks', 'Merlot')).toBe('Wine');
    expect(guessProtein('Chicken Fried Steak')).toBe('beef');
    expect(guessProtein('Shrimp Scampi')).toBe('shellfish');
    expect(subOf({ cat: 'Entrees', name: 'Lasagna', sub: 'Nonsense' })).toBe('Pasta');
  });
});

describe('menu builder layout', () => {
  const g = (id: string, recipeId: string, cat: GridEntry['cat'], extra: Partial<GridEntry> = {}): GridEntry => ({ id, menuId: 'm', recipeId, day: 1, meal: 'Dinner', cat, sort: 1, ...extra });
  it('puts each side under the entrée it goes with', () => {
    const names: Record<string, string> = { e1: 'Pot Roast', e2: 'Salmon', s1: 'Garlic Mashed Potatoes', s2: 'Rice Pilaf', s3: 'Green Beans' };
    const out = groupDay(
      [g('a', 'e1', 'Entrees'), g('b', 'e2', 'Entrees'), g('c', 's2', 'Sides'), g('d', 's1', 'Sides'), g('e', 's3', 'Sides', { with: 'b' })],
      (rid) => (rid === 'e1' ? ['mash'] : []),
      (id) => (id === 'mash' ? 'Mashed Potatoes' : names[id]),
    );
    expect(out.entrees[0].sides.map((x) => x.recipeId)).toEqual(['s1']);
    expect(out.entrees[1].sides.map((x) => x.recipeId)).toEqual(['s3']);
    expect(out.looseSides.map((x) => x.recipeId)).toEqual(['s2']);
  });
  it('matches side names loosely', () => {
    expect(sideMatches('Garlic Mashed Potatoes', 'Mashed Potatoes')).toBe(true);
    expect(sideMatches('Rice Pilaf', 'Mashed Potatoes')).toBe(false);
  });
  it('reads target days for Copy day', () => {
    expect(parseDays('7, 8 9, 99, 3', 35, 3)).toEqual([7, 8, 9]);
  });
});

describe('menu list', () => {
  const nowQ = 2026 * 4 + 3;
  const venues = venuesAt(SEED.venues, Date.now());
  it('lists the quarter’s cycles and, with à la carte, a cycle’s every-day items', () => {
    const q = SEED.menus.find((m) => m.id === 'm1')!.quarter;
    const rows = menuRows(SEED.menus, SEED.grid, venues, 'alc', q, '', quarterLabelIndex(q));
    expect(rows.some((r) => r.everyDay && r.menu.id === 'm1')).toBe(true);
    expect(menuRows(SEED.menus, SEED.grid, venues, 'cycle', q, 'zzz', nowQ)).toEqual([]);
  });
  it('flags a future quarter with no menu', () => {
    expect(quarterGaps([], [], [], 'cycle', 'Q2 2027', nowQ)).toEqual(['cycle']);
    expect(quarterGaps([], [], [], 'cycle', 'Q2 2020', nowQ)).toEqual([]);
  });
});

function quarterLabelIndex(q: string): number {
  const m = /^Q(\d) (\d{4})$/.exec(q)!;
  return +m[2] * 4 + +m[1] - 1;
}

describe('recipe drafts', () => {
  it('reads a pasted recipe', () => {
    const r = parseRecipeText('2 lb ground beef\n½ cup breadcrumbs\n2 eggs\nMix gently, form a loaf, bake at 350 for 45 minutes.\nServes 8');
    expect(r.ingredients).toEqual([
      { qty: 2, unit: 'lb', name: 'ground beef' },
      { qty: 0.5, unit: 'cup', name: 'breadcrumbs' },
      { qty: 2, unit: '', name: 'eggs' },
    ]);
    expect(r.method).toHaveLength(1);
    expect(r.baseServings).toBe(8);
  });
  it('writes quantities as kitchen fractions and scales units up', () => {
    expect(fraction(0.25)).toBe('¼');
    expect(fraction(1.5)).toBe('1 ½');
    expect(qtyUnit(1, 'tsp', false)).toBe('1 tsp');
    expect(qtyUnit(3, 'tsp', true)).toBe('1 tbsp');
    expect(qtyUnit(32, 'oz', true)).toBe('2 lb');
  });
  it('spots choice words in a menu descriptor', () => {
    expect(choiceWords('Grilled chicken or shrimp over rice')).toBe('chicken or shrimp');
    expect(choiceWords('Served with or without gravy')).toBeNull();
    expect(choiceWords('Your choice of dressing')).toBe('Your choice');
  });
});

describe('recipe scores', () => {
  const r: Recipe = { id: 'x', name: 'Pot Roast', cat: 'Entrees', desc: '', sales: { orders: 40, per: 20, src: 'P-Mix' } };
  const fb = (sent: FeedbackEntry['sent'], daysAgo: number): FeedbackEntry => ({ id: sent + daysAgo, name: 'Pot Roast', rid: 'r1', who: '', text: '', sent, at: Date.now() - daysAgo * DAY_MS, src: 'Voice note' });
  it('blends feedback and sales, and spots a trend', () => {
    const list = [fb('pos', 1), fb('pos', 2), fb('pos', 3), fb('neg', 40), fb('neg', 41), fb('neg', 42)];
    const sc = recipeScore(r, list, popularity([r]), Date.now())!;
    expect(sc.n).toBe(6);
    expect(sc.trend).toBe('up');
    expect(sc.score).toBeGreaterThan(2.5);
    expect(recipeScore({ ...r, cat: 'Drinks' }, list, new Map(), Date.now())).toBeNull();
  });
  it('links a server note to the dish it names', () => {
    const dishes = [{ name: 'Yankee Pot Roast' }, { name: 'Chicken Pot Pie' }];
    expect(mentionScore('Loved the yankee pot roast tonight', 'Yankee Pot Roast')).toBeGreaterThan(100);
    expect(noteDish('said the pot roast was dry', dishes)?.name).toBe('Yankee Pot Roast');
    expect(noteDish('nice evening', dishes)).toBeNull();
  });
});

describe('recipe filters', () => {
  it('filters by category and text and sorts by name', () => {
    const out = filterRecipes(SEED.recipes, { ...NO_FILTERS, cat: 'Desserts', q: 'pie' }, { scoreOf: () => null, onMenu: new Set(), favorites: {}, shortOf: (x) => x.name });
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((x) => x.cat === 'Desserts' && /pie/i.test(x.name + x.desc))).toBe(true);
  });
});

describe('pricing', () => {
  const burger = SEED.recipes.find((r) => r.id === 'l_burger')!;
  it('keeps only prices that differ from the menu', () => {
    let rows = setPrice([], 'v1', burger, 'guest', 15);
    expect(rows).toEqual([{ recipeId: 'l_burger', venueId: 'v1', res: null, guest: 15, ala: null }]);
    rows = setPrice(rows, 'v1', burger, 'guest', null);
    expect(rows).toEqual([]);
  });
  it('finds prices for recipes no longer on the menu', () => {
    const rows = [{ recipeId: 'gone', venueId: 'v1', res: 1, guest: null, ala: null }];
    expect(orphanPrices(rows, 'v1', ['l_burger'])).toEqual(rows);
  });
});

describe('printed menus', () => {
  it('escapes everything it prints', () => {
    expect(esc('<b>"Mac" & cheese</b>')).toBe('&lt;b&gt;&quot;Mac&quot; &amp; cheese&lt;/b&gt;');
    expect(andList(['a', 'b', 'c'])).toBe('a, b and c');
  });
  it('builds the daily menu and order form for a venue', () => {
    const recipes = SEED.recipes.map((r) => (r.id === 'd_peach' ? { ...r, name: 'Peach <script>' } : r));
    const C = printContext({ ...SEED, recipes }, { venueId: 'v1', at: Date.now() }, () => []);
    // The seeded venue's cycle is turned so today keeps its specials; weeks run Sunday to Saturday.
    expect(C.today).toBe(shiftDay(SEED_TODAY, seedShift(Date.now()), 35));
    const html = dailyMenuHtml(C, C.today);
    expect(html).toContain('Peach &lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('Consuming raw or undercooked');
    expect(orderFormHtml(C, 2)).toContain('Lunch pick up runs');
  });
});

describe('AI review', () => {
  const recipes = new Map(SEED.recipes.map((r) => [r.id, r]));
  it('finds a repeated soup and clears it when fixed', () => {
    const base: GridEntry[] = [1, 2].map((d) => ({ id: 's' + d, menuId: 'mx', recipeId: 'vw_splitpea', day: d, meal: 'Lunch', cat: 'Starters', sort: d }));
    const f = aiCheck({ menuId: 'mx', grid: base, recipes, len: 7, season: 'Fall', target: null, pastSeason: [], scoreOf: () => null });
    expect(f.some((x) => x.id.startsWith('soup|') && /back-to-back/.test(x.msg))).toBe(true);
    const fixed = aiCheck({ menuId: 'mx', grid: base.slice(0, 1), recipes, len: 7, season: 'Fall', target: null, pastSeason: [], scoreOf: () => null });
    expect(fixed).toEqual([]);
  });
  it('applies a swap and undoes it', () => {
    const grid: GridEntry[] = [{ id: 'e', menuId: 'mx', recipeId: 'a', day: 3, meal: 'Dinner', cat: 'Entrees', sort: 1 }];
    let n = 0;
    const res = applyOps([{ op: 'entree', day: 3, meal: 'Dinner', from: 'a', to: 'b', side: 's' }], { menuId: 'mx', grid, sides: {}, sidesOf: () => [], newId: () => 'n' + n++ })!;
    expect(res.grid.find((g) => g.id === 'e')!.recipeId).toBe('b');
    expect(res.grid.some((g) => g.recipeId === 's' && g.cat === 'Sides')).toBe(true);
    expect(res.sides.mx[3].b).toEqual(['s']);
    const back = undoOps(res.undo, 'mx', res.grid, res.sides);
    expect(back.grid).toEqual(grid);
    expect(back.sides.mx[3]).toEqual({});
    expect(applyOps([{ op: 'dessert', day: 9, meal: 'Lunch', to: 'x' }], { menuId: 'mx', grid, sides: {}, sidesOf: () => [], newId: () => 'z' })).toBeNull();
  });
});

describe('menu builder helpers', () => {
  it('copies a day to the same weekday in every other week', () => {
    expect(sameWeekday(3, 35)).toEqual([10, 17, 24, 31]);
    expect(sameWeekday(10, 35)).toEqual([3, 17, 24, 31]);
    expect(sameWeekday(7, 14)).toEqual([14]);
  });
});

describe('typing a recipe into a slot', () => {
  const r = (id: string, name: string, cat: Recipe['cat'], retired = false) => ({ id, name, cat, retired }) as Recipe;
  const book = [r('a', 'Chicken Noodle Soup', 'Starters'), r('b', 'Chicken Breast', 'Entrees'), r('c', 'Grilled Chicken Salad', 'Entrees'), r('d', 'Old Chicken Pie', 'Entrees', true)];

  it('finds every typed word in the category, names that start with the text first', () => {
    expect(searchRecipes(book, 'chicken', 'Entrees').list.map((x) => x.id)).toEqual(['b', 'c']);
    expect(searchRecipes(book, 'salad chick', 'Entrees').list.map((x) => x.id)).toEqual(['c']);
    expect(searchRecipes(book, 'chicken', null).list.map((x) => x.id)).toEqual(['b', 'a', 'c']);
  });

  it('leaves out retired recipes and says when the text is already a recipe', () => {
    expect(searchRecipes(book, 'pie', 'Entrees').list).toEqual([]);
    expect(searchRecipes(book, 'chicken breast', 'Entrees').exact).toBe(true);
    expect(searchRecipes(book, 'chicken bre', 'Entrees').exact).toBe(false);
  });
});

describe('drinks: alcoholic vs non-alcoholic', () => {
  const ctx = { scoreOf: () => null, onMenu: new Set<string>(), favorites: {}, shortOf: (x: { name: string }) => x.name };
  it('splits the drinks by their subcategory group', () => {
    const alc = filterRecipes(SEED.recipes, { ...NO_FILTERS, cat: 'Drinks', group: 'Alcoholic' }, ctx);
    const na = filterRecipes(SEED.recipes, { ...NO_FILTERS, cat: 'Drinks', group: 'Non-Alcoholic' }, ctx);
    const all = filterRecipes(SEED.recipes, { ...NO_FILTERS, cat: 'Drinks' }, ctx);
    expect(alc.length).toBeGreaterThan(0);
    expect(na.length).toBeGreaterThan(0);
    expect(alc.length + na.length).toBe(all.length);
    expect(alc.map((r) => r.name)).toContain('Captain Morgan Rum');
    expect(na.map((r) => r.name)).toContain('BTL - Fre Cabernet No Alcohol');
    expect(inGroup(alc[0], 'Non-Alcoholic')).toBe(false);
  });
});
