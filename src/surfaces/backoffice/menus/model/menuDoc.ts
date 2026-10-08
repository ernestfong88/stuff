/**
 * What a printed menu says, page by page, before it is drawn: the HTML
 * printout and the Word export are both made from this, so they always
 * list the same dishes under the same headings. Splitting a page in two
 * (a daily menu too long for one page, or à la carte on two pages) moves
 * whole blocks, so a meal or a category never breaks across pages.
 */
import { addDays, monthDay } from '../../../../domain/menuCycle';
import { dishLong } from './categories';
import { pickupSpan } from './pickupWindows';
import { tabletItem } from './tablet';
import { splitAt } from './printFit';
import type { PrintContext, PrintKind, PrintLine } from './menuPrint';

export const PRINT_MEALS = ['Breakfast', 'Lunch', 'Dinner'] as const;

export const SECTIONS: Array<[PrintLine['c'], string]> = [
  ['Starters', 'To Start'],
  ['Entrees', 'Entrées'],
  ['Sides', 'Sides'],
  ['Desserts', 'Dessert'],
];

export interface DocItem {
  name: string;
  desc?: string;
  /** "Served with ..." sides. */
  sides?: string[];
  diets: string[];
  /** Small italic notes after the name: "+$4", "lunch only". */
  tags: string[];
}

export interface DocCat {
  label: string;
  items: DocItem[];
  /** Listed on one line, "a · b · c" (à la carte sides). */
  line?: boolean;
  /** Carries on the course above it (a long course is cut in pieces so two pages can balance). */
  cont?: boolean;
}

/** À la carte courses are cut into pieces of this many dishes, so a long course can carry onto the second page. */
export const COURSE_PIECE = 4;

export type DocBlock =
  /** A meal and its courses (daily), or one course of an à la carte section (`sec`). */
  | { t: 'meal'; title: string; cats: DocCat[]; cycle?: boolean; sec?: string; first?: boolean }
  /** A meal with no specials: the everyday entrées on a line. */
  | { t: 'list'; title: string; names: string[]; note: string }
  | { t: 'note'; text: string; glue?: boolean }
  | { t: 'snacks'; names: string[] }
  | {
      t: 'week';
      heads: Array<[string, string]>;
      rows: Array<{ meal: string; cells: Array<Array<{ k: 's' | 'e' | 'd'; name: string }>> }>;
      note: string;
    }
  | { t: 'orderTop'; how: string }
  | { t: 'orderDay'; date: string; meals: Array<{ meal: string; items: Array<{ name: string; diets: string[] }> }> };

export interface DocSheet {
  kicker: string;
  title: string;
  blocks: DocBlock[];
  /** Two cycle meals print side by side. */
  pair?: boolean;
}

export interface MenuDoc {
  kind: PrintKind;
  /** The file and window title. */
  title: string;
  landscape: boolean;
  /** Daily and à la carte menus are centred, the week and the order form are not. */
  centered: boolean;
  sheets: DocSheet[];
}

export const RAW_FOOD_NOTICE =
  'Consuming raw or undercooked meats, poultry, seafood, shellfish, or eggs may increase your risk of foodborne illness.';

/** The footer every printed page carries. */
export const FOOT_LINES = [
  'Please tell your server about any food allergies or dietary needs. Menu items may change based on availability.',
  RAW_FOOD_NOTICE,
];

/** Everyday entrées a meal with no specials lists on the daily menu (at most 12). */
export const everydayEntrees = (C: PrintContext, m: string) =>
  C.at(0, m)
    .filter((x) => x.c === 'Entrees' && !/pureed|molded/i.test(x.r.name))
    .slice(0, 12);

export const snackLines = (C: PrintContext, day: number) => [...C.at(day, 'Snacks'), ...(day ? C.at(0, 'Snacks') : [])];

/** The meals a daily menu can print on their own: Breakfast, Lunch, Dinner, and Snacks when the menu has any. */
export function printMeals(C: PrintContext): string[] {
  const days = Array.from({ length: C.len + 1 }, (_, d) => d);
  return days.some((d) => C.at(d, 'Snacks').length) ? [...PRINT_MEALS, 'Snacks'] : [...PRINT_MEALS];
}

/** The meals the à la carte menu serves something at. */
export function alaCarteMeals(C: PrintContext): string[] {
  return PRINT_MEALS.filter((m) => C.at(0, m).some((x) => !/pureed|molded/i.test(x.r.name)));
}

/** Cycle days in week w (0 based). */
export function weekDays(C: PrintContext, w: number): number[] {
  return Array.from({ length: 7 }, (_, i) => w * 7 + i + 1).filter((d) => d <= Math.max(C.len, 1));
}

/** The week to print: the one asked for, else the week today falls in. */
export function printWeek(C: PrintContext, week?: number | null): number {
  return week != null ? week : C.today ? Math.ceil(C.today / 7) - 1 : 0;
}

/** Any Day items for the à la carte menu: each dish once, with the meals it is served at. */
export function alaCarteItems(C: PrintContext): Array<{ x: PrintLine; meals: Set<string> }> {
  const by = new Map<string, { x: PrintLine; meals: Set<string> }>();
  for (const m of PRINT_MEALS) {
    for (const x of C.at(0, m)) {
      if (/pureed|molded/i.test(x.r.name)) continue;
      const o = by.get(x.r.name) ?? { x, meals: new Set<string>() };
      o.meals.add(m);
      by.set(x.r.name, o);
    }
  }
  return [...by.values()];
}

/** The picked meals in menu order. */
export function pickedMeals(picked: readonly string[] | undefined, allowed: readonly string[]): string[] {
  return allowed.filter((m) => picked?.includes(m));
}

function item(x: PrintLine, C: PrintContext, sides: string[] = [], tags: string[] = []): DocItem {
  const desc = x.r.menuDescriptor || x.r.desc;
  return {
    name: dishLong(x.r.name),
    desc: desc || undefined,
    sides: sides.length ? sides : undefined,
    diets: C.options.diet ? (x.r.dietFlags ?? []) : [],
    tags,
  };
}

/** The printout's choices, beyond the print options. */
export interface MenuPick {
  week?: number | null;
  day?: number | null;
  /** Daily: these meals, a page each; à la carte: these meals, a section each. Empty or unset prints every meal. */
  meals?: string[];
  /** À la carte: the Sunday of the week it is printed for. */
  weekOf?: Date | null;
  /** À la carte: on one page, or split by course over two. */
  pages?: 1 | 2;
}

const longDate = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

/**
 * The day's menu by meal. Meals with no specials list the everyday entrées.
 * A venue with no cycle (only an à la carte menu) prints that menu in full.
 * With `meals`, each of those meals prints on a page of its own.
 */
export function dailyDoc(C: PrintContext, day: number, meals: string[] = []): MenuDoc {
  const d = C.dateOf(day);
  const noCycle = C.len === 0;
  const lines = (m: string) => C.at(noCycle ? 0 : day, m);
  const block = (m: string): DocBlock | null => {
    const L = lines(m);
    if (!L.length) {
      const A = everydayEntrees(C, m);
      return A.length && !noCycle
        ? { t: 'list', title: m, names: A.map((x) => dishLong(x.r.name)), note: 'Served from the à la carte menu every day.' }
        : null;
    }
    return {
      t: 'meal',
      title: m,
      cycle: !noCycle,
      cats: SECTIONS.map(([c, label]) => ({
        label,
        items: L.filter((x) => x.c === c).map((x) => item(x, C, c === 'Entrees' && !noCycle ? C.sides(day, x.r.id) : [])),
      })).filter((c) => c.items.length),
    };
  };
  const snacks = (always: boolean): DocBlock | null => {
    if (!C.options.snacks && !always) return null;
    const list = snackLines(C, day);
    return list.length ? { t: 'snacks', names: list.map((x) => dishLong(x.r.name)) } : null;
  };
  const date = longDate(d);
  const picked = pickedMeals(meals, [...PRINT_MEALS, 'Snacks']);
  const present = <T>(a: Array<T | null>) => a.filter((x): x is T => x != null);
  if (picked.length) {
    return {
      kind: 'daily',
      title: picked.join(', ') + ' menu ' + monthDay(d),
      landscape: false,
      centered: true,
      sheets: picked.map((m) => {
        const inner = present(
          m === 'Snacks'
            ? [snacks(true)]
            : [block(m), !noCycle && lines(m).length ? { t: 'note' as const, text: 'The à la carte menu is also available.', glue: true } : null],
        );
        return {
          kicker: C.venueName,
          title: m + ' · ' + date,
          blocks: inner.length ? inner : [{ t: 'note' as const, text: 'Nothing is on the ' + m.toLowerCase() + ' menu this day.' }],
        };
      }),
    };
  }
  const cycleMeals = PRINT_MEALS.filter((m) => lines(m).length);
  const everyday = present(PRINT_MEALS.filter((m) => !lines(m).length).map(block));
  // Only a menu with specials needs saying the à la carte menu is there too (the everyday blocks already say so).
  const alsoAlc = !noCycle && cycleMeals.length > 0;
  return {
    kind: 'daily',
    title: 'Daily menu ' + monthDay(d),
    landscape: false,
    centered: true,
    sheets: [
      {
        kicker: C.venueName,
        title: date,
        pair: cycleMeals.length === 2,
        blocks: present([
          ...everyday,
          ...cycleMeals.map(block),
          alsoAlc ? { t: 'note' as const, text: 'The à la carte menu is also available at every meal.', glue: true } : null,
          snacks(false),
        ]),
      },
    ],
  };
}

/** The week at a glance: a landscape table of days by meal. */
export function weekDoc(C: PrintContext, w: number): MenuDoc {
  const ds = weekDays(C, w);
  const ms = PRINT_MEALS.filter((m) => ds.some((d) => C.at(d, m).length));
  const a = C.dateOf(ds[0]);
  const b = C.dateOf(ds[ds.length - 1]);
  const K = { Starters: 's', Entrees: 'e', Desserts: 'd' } as const;
  return {
    kind: 'week',
    title: 'Week at a glance',
    landscape: true,
    centered: false,
    sheets: [
      {
        kicker: C.venueName + ' · Week at a glance',
        title: monthDay(a) + ' to ' + monthDay(b),
        blocks: [
          {
            t: 'week',
            heads: ds.map((d) => [
              C.dateOf(d).toLocaleDateString('en-US', { weekday: 'long' }),
              C.dateOf(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            ]),
            rows: ms.map((m) => ({
              meal: m,
              cells: ds.map((d) => {
                const L = C.at(d, m);
                return (['Starters', 'Entrees', 'Desserts'] as const).flatMap((c) =>
                  L.filter((x) => x.c === c).map((x) => ({ k: K[c], name: dishLong(x.r.name) })),
                );
              }),
            })),
            note: 'Soups in italics, entrées in bold, desserts in grey. The à la carte menu is available at every meal.',
          },
        ],
      },
    ],
  };
}

/**
 * The Any Day menu. Every meal: Breakfast, then Lunch and Dinner, each dish
 * once with "lunch only" or "dinner only" where it applies. With `meals`
 * picked: a section per meal, listing what is served at it. With `weekOf`
 * (a Sunday), it is dated for that week.
 */
export function alaCarteDoc(C: PrintContext, opts: MenuPick = {}): MenuDoc {
  const all = alaCarteItems(C);
  const picked = pickedMeals(opts.meals, alaCarteMeals(C));
  type Entry = (typeof all)[number];
  const sec = (title: string, L: Entry[], tag?: (e: Entry) => string): DocBlock[] =>
    SECTIONS.map(([c, label]) => ({ c, label, I: L.filter((e) => e.x.c === c) }))
      .filter((g) => g.I.length)
      .flatMap((g) =>
        // Sides print on one line, so they stay whole.
        (g.c === 'Sides'
          ? [g.I]
          : Array.from({ length: Math.ceil(g.I.length / COURSE_PIECE) }, (_, k) => g.I.slice(k * COURSE_PIECE, (k + 1) * COURSE_PIECE))
        ).map((I, k) => ({ ...g, I, cont: k > 0 })),
      )
      .map((g, i) => ({
        t: 'meal' as const,
        title,
        sec: title,
        first: i === 0,
        cats: [
          {
            label: g.label,
            line: g.c === 'Sides',
            cont: g.cont,
            items: g.I.map((e) => {
              const res = tabletItem(e.x.r.id)?.residentPrice ?? 0;
              const t = tag?.(e);
              return item(e.x, C, [], [...(res > 0 ? ['+$' + res] : []), ...(t ? [t] : [])]);
            }),
          },
        ],
      }));
  const blocks: DocBlock[] = picked.length
    ? picked.flatMap((m) =>
        sec(
          m,
          all.filter((e) => e.meals.has(m)),
        ),
      )
    : [
        ...sec(
          'Breakfast',
          all.filter((e) => e.meals.has('Breakfast')),
        ),
        ...sec(
          'Lunch and Dinner',
          all.filter((e) => e.meals.has('Lunch') || e.meals.has('Dinner')),
          (e) => (e.meals.has('Lunch') && e.meals.has('Dinner') ? '' : e.meals.has('Lunch') ? 'lunch only' : 'dinner only'),
        ),
      ];
  const snacks = C.options.snacks ? snackLines(C, 0) : [];
  if (snacks.length) blocks.push({ t: 'snacks', names: snacks.map((x) => dishLong(x.r.name)) });
  const when = opts.weekOf ? monthDay(opts.weekOf) + ' to ' + monthDay(addDays(opts.weekOf, 6)) : 'available every day';
  return {
    kind: 'alacarte',
    title: (picked.length ? picked.join(', ') + ' ' : '') + 'A la carte menu',
    landscape: false,
    centered: true,
    sheets: [
      {
        kicker: C.venueName,
        title: (picked.length ? picked.join(' and ') + ' · ' : '') + 'À la carte · ' + when,
        blocks: blocks.length ? blocks : [{ t: 'note', text: 'Nothing is on the à la carte menu yet.' }],
      },
    ],
  };
}

/** The weekly order form for residents who pick up, with tick boxes and lines. */
export function orderDoc(C: PrintContext, w: number): MenuDoc {
  const ds = weekDays(C, w);
  const a = C.dateOf(ds[0]);
  const b = C.dateOf(ds[ds.length - 1]);
  const lunch = pickupSpan(C.options.winGrid, C.room, 'Lunch');
  const dinner = pickupSpan(C.options.winGrid, C.room, 'Dinner');
  const ranges =
    lunch && dinner
      ? `Lunch pick up runs ${lunch} and dinner ${dinner}. `
      : lunch
        ? `Lunch pick up runs ${lunch}. `
        : dinner
          ? `Dinner pick up runs ${dinner}. `
          : '';
  const days: DocBlock[] = ds
    .map((d) => ({ d, ms: ['Lunch', 'Dinner'].filter((m) => C.at(d, m).length) }))
    .filter((x) => x.ms.length)
    .map(({ d, ms }) => ({
      t: 'orderDay',
      date: longDate(C.dateOf(d)),
      meals: ms.map((m) => ({
        meal: m,
        items: C.at(d, m)
          .filter((x) => x.c !== 'Sides')
          .map((x) => ({ name: dishLong(x.r.name), diets: C.options.diet ? (x.r.dietFlags ?? []) : [] })),
      })),
    }));
  return {
    kind: 'order',
    title: 'Weekly order form',
    landscape: false,
    centered: false,
    sheets: [
      {
        kicker: C.venueName + ' · Pick up order form',
        title: monthDay(a) + ' to ' + monthDay(b),
        blocks: [
          {
            t: 'orderTop',
            how:
              'Tick each dish you would like and write how many on the line. Write the 15 minute range you will pick up in, for example 11:30 to 11:45. ' +
              ranges +
              'Hand the form to a server or leave it at the front desk by 2 PM the day before.',
          },
          ...(days.length ? days : [{ t: 'note' as const, text: 'No lunch or dinner specials are placed on this week yet.' }]),
        ],
      },
    ],
  };
}

export function menuDoc(kind: PrintKind, C: PrintContext, opts: MenuPick = {}): MenuDoc {
  const w = printWeek(C, opts.week);
  const day = opts.day || C.today || w * 7 + 1;
  if (kind === 'week') return weekDoc(C, w);
  if (kind === 'alacarte') return alaCarteDoc(C, opts);
  if (kind === 'order') return orderDoc(C, w);
  return dailyDoc(C, day, opts.meals);
}

/**
 * The places a page can be split: before each block that is not glued to
 * the one above it. Returns the units as block index ranges.
 */
export function splitUnits(blocks: DocBlock[]): number[][] {
  const units: number[][] = [];
  blocks.forEach((b, i) => {
    if (b.t === 'note' && b.glue && units.length) units[units.length - 1].push(i);
    else units.push([i]);
  });
  return units;
}

/**
 * Split a page in two, balanced by the measured height of each block, and
 * never inside a block. A page with one block stays one page.
 */
export function splitSheet(sheet: DocSheet, heights: number[]): DocSheet[] {
  const units = splitUnits(sheet.blocks);
  if (units.length < 2) return [sheet];
  const k = splitAt(units.map((u) => u.reduce((n, i) => n + (heights[i] ?? 0), 0)));
  const at = units[k][0];
  return [
    { ...sheet, pair: false, blocks: sheet.blocks.slice(0, at) },
    { ...sheet, pair: false, blocks: sheet.blocks.slice(at) },
  ];
}

/** A doc with its first page split in two (see splitSheet). */
export function splitDoc(doc: MenuDoc, heights: number[]): MenuDoc {
  const [first, ...rest] = doc.sheets;
  return { ...doc, sheets: [...splitSheet(first, heights), ...rest] };
}
