/**
 * Printed menus: four letter-size printouts from the menu builder and Menu
 * Export. The day's menu by meal, the week at a glance, the Any Day à la
 * carte menu and the weekly order form for residents who pick up. Always
 * the full dish name, and every value is escaped.
 */
import { COMMUNITY_NAME } from '../../../../data';
import type { GridEntry, Recipe } from '../../../../store/menuEdits';
import type { BoState } from './types';
import { dishLong, normCategory } from './categories';
import { addDays, cycleDayOn, dayStart, menuAnchor, monthDay, venuesAt, type CycleAnchor } from '../../../../domain/menuCycle';
import { pickupSpan } from './pickupWindows';
import { tabletItem } from './tablet';

export type PrintKind = 'daily' | 'week' | 'alacarte' | 'order';
export type TemplateId = 'classic' | 'coastal' | 'bistro';

export const TEMPLATES: Array<{ id: TemplateId; name: string; use: string }> = [
  { id: 'classic', name: 'Classic Serif', use: 'Kisco standard' },
  { id: 'coastal', name: 'Coastal Light', use: 'Signature venues' },
  { id: 'bistro', name: 'Bistro Card', use: 'casual venues' },
];

export const RAW_FOOD_NOTICE = 'Consuming raw or undercooked meats, poultry, seafood, shellfish, or eggs may increase your risk of foodborne illness.';

const SECTIONS: Array<[PrintCat, string]> = [
  ['Starters', 'To Start'],
  ['Entrees', 'Entrées'],
  ['Sides', 'Sides'],
  ['Desserts', 'Dessert'],
];
const PRINT_MEALS = ['Breakfast', 'Lunch', 'Dinner'] as const;

type PrintCat = 'Starters' | 'Entrees' | 'Sides' | 'Desserts' | 'Drinks';

export function printCategory(cat: string): PrintCat {
  const c = normCategory(cat);
  return c === 'Drinks' ? 'Drinks' : c === 'Starters' ? 'Starters' : c === 'Sides' ? 'Sides' : c === 'Desserts' ? 'Desserts' : 'Entrees';
}

export interface PrintLine {
  g: GridEntry;
  r: Recipe;
  c: PrintCat;
}

export interface PrintOptions {
  venueId?: string;
  menuId?: string;
  /** Dates the builder shows, so the printout matches the screen. */
  anchor?: CycleAnchor | null;
  template?: TemplateId;
  /** Show diet indicators (Gluten-Friendly ...) after each dish. */
  diet?: boolean;
  /** Add the Snacks section (dietitian copy). */
  snacks?: boolean;
  /** Service config pick up grid (win.grid), for the order form. */
  winGrid?: unknown;
  at: number;
}

export interface PrintContext {
  venueName: string;
  room: string;
  menuId: string | null;
  len: number;
  /** Today's cycle day when the menu is running at the venue, else 0. */
  today: number;
  start: Date;
  options: PrintOptions;
  at(day: number, meal?: string): PrintLine[];
  sides(day: number, recipeId: string): string[];
  dateOf(day: number): Date;
}

/** The dining room the venue's tablets belong to (for pick up ranges). */
export function venueRoom(venueId: string | undefined): string {
  return venueId === 'v3' ? 'bistro' : 'sequoia';
}

export function printContext(bo: BoState, o: PrintOptions, sidesOf: (menuId: string, day: number, recipeId: string) => string[]): PrintContext {
  const venues = venuesAt(bo.venues, o.at);
  const v = venues.find((x) => x.id === o.venueId) ?? venues.find((x) => x.active && (x.menuId === o.menuId || x.alcMenuId === o.menuId)) ?? venues.find((x) => x.active && (x.menuId || x.alcMenuId));
  const menuId = o.menuId ?? v?.menuId ?? v?.alcMenuId?.replace(/:everyday$/, '') ?? null;
  const menu = bo.menus.find((m) => m.id === menuId);
  let last = 0;
  for (const g of bo.grid) if (g.menuId === menuId && g.day > last) last = g.day;
  const len = menu && menu.kind === 'cycle' ? Math.max(menu.cycleLen || 0, last) : 0;
  const t0 = dayStart(o.at);
  const live = len > 0 && !!v && v.menuId === menuId && v.menuStartDt != null && dayStart(v.menuStartDt) <= t0;
  const anchor = o.anchor ?? (menu ? menuAnchor(menu, venues, len, o.at) : null);
  const today = live && v ? (cycleDayOn(v.menuStartDt, len, o.at) ?? 1) : anchor?.live ? (anchor.today ?? 0) : 0;
  const start = anchor ? anchor.start : live ? addDays(t0, 1 - today) : t0;
  const recipes = new Map(bo.recipes.map((r) => [r.id, r]));
  return {
    venueName: v?.name ?? 'Dining Room',
    room: venueRoom(v?.id),
    menuId,
    len,
    today,
    start,
    options: o,
    at(day, meal) {
      return bo.grid
        .filter((g) => g.menuId === menuId && g.day === day && (!meal || g.meal === meal))
        .map((g) => ({ g, r: recipes.get(g.recipeId)!, c: printCategory(g.cat) }))
        .filter((x) => x.r && !x.r.placeholder && x.c !== 'Drinks')
        .sort((a, b) => a.g.sort - b.g.sort);
    },
    sides(day, recipeId) {
      return menuId
        ? sidesOf(menuId, day, recipeId)
            .map((id) => recipes.get(id)?.name ?? tabletItem(id)?.name ?? '')
            .filter(Boolean)
        : [];
    },
    dateOf: (day) => addDays(start, day - 1),
  };
}

// ─── HTML ────────────────────────────────────────────────────────────────

/** Escape text for HTML. */
export function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** "a, b and c" */
export function andList(a: string[]): string {
  return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
}

const TEMPLATE_CSS: Record<TemplateId, string> = {
  classic: `body{font-family:Georgia,"Times New Roman",serif}:root{--accent:#145785}`,
  coastal: `body{font-family:"Helvetica Neue",Arial,sans-serif;font-weight:300}:root{--accent:#3D7FAE}.brand{font-weight:200;letter-spacing:.12em;text-transform:uppercase}.nm{font-weight:500}`,
  bistro: `body{font-family:Georgia,"Times New Roman",serif}:root{--accent:#A8703B}.hd{border-bottom-style:double;border-bottom-width:4px}.brand{font-style:italic}`,
};

const BASE_CSS =
  '*{box-sizing:border-box}body{color:#1B2630;margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
  '.hd{text-align:center;border-bottom:2px solid var(--accent);padding-bottom:9px;margin-bottom:14px}.brand{font-size:26px;letter-spacing:.05em;color:var(--accent)}' +
  '.kick{font:700 10px/1.3 -apple-system,system-ui,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#6B7780}.ttl{font-size:17px;margin-top:6px}' +
  '.ft{margin-top:16px;padding-top:8px;border-top:1px solid #C9D2DA;font:11px/1.45 -apple-system,system-ui,sans-serif;color:#5E6B74;text-align:center}' +
  'h2{font-size:18px;font-weight:normal;color:var(--accent);letter-spacing:.06em;text-transform:uppercase;margin:0 0 6px;border-bottom:1px solid #C9D2DA;padding-bottom:3px}' +
  '.cat{font:700 10px/1.3 -apple-system,system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#6B7780;margin:9px 0 3px}' +
  '.it{margin:0 0 6px;break-inside:avoid}.nm{font-size:14.5px;font-weight:bold}.ds{font-size:12px;font-style:italic;color:#3A4751}.sd{font-size:12px;color:#3A4751}' +
  '.dt{font:600 9.5px -apple-system,system-ui,sans-serif;color:#4F6A38;border:1px solid #B9CBA6;border-radius:8px;padding:0 5px;margin-left:5px;vertical-align:2px;white-space:nowrap}' +
  '.meal{margin-bottom:14px;break-inside:avoid}.any{font-size:13px;margin:4px 0}.note{font:11.5px -apple-system,system-ui,sans-serif;color:#6B7780;margin:2px 0}' +
  '.diet-only{border:1px dashed #A8703B;border-radius:6px;padding:6px 10px;margin-top:10px}' +
  '@media screen{body{padding:.5in;background:#fff}}';

function doc(title: string, body: string, o: PrintOptions, landscape = false): string {
  return (
    '<!doctype html><html><head><meta charset="utf-8"><title>' +
    esc(title) +
    '</title><style>@page{size:letter' +
    (landscape ? ' landscape' : '') +
    ';margin:.5in}' +
    BASE_CSS +
    TEMPLATE_CSS[o.template ?? 'classic'] +
    '</style></head><body>' +
    body +
    '</body></html>'
  );
}

function head(kicker: string, title: string): string {
  return (
    '<div class="hd"><div class="kick">' +
    esc(kicker) +
    '</div><div class="brand">' +
    esc(COMMUNITY_NAME) +
    '</div><div class="ttl">' +
    esc(title) +
    '</div></div>'
  );
}

const FOOT =
  '<div class="ft">Please tell your server about any food allergies or dietary needs. Menu items may change based on availability.<br>' +
  esc(RAW_FOOD_NOTICE) +
  '</div>';

function diets(r: Recipe, o: PrintOptions): string {
  return o.diet ? (r.dietFlags ?? []).map((d) => '<span class="dt">' + esc(d) + '</span>').join('') : '';
}

function dish(x: PrintLine, o: PrintOptions, sides: string[] = [], extra = ''): string {
  const desc = x.r.menuDescriptor || x.r.desc;
  return (
    '<div class="it"><div class="nm">' +
    esc(dishLong(x.r.name)) +
    extra +
    diets(x.r, o) +
    '</div>' +
    (desc ? '<div class="ds">' + esc(desc) + '</div>' : '') +
    (sides.length ? '<div class="sd">Served with ' + esc(andList(sides)) + '</div>' : '') +
    '</div>'
  );
}

function snacksBlock(C: PrintContext, day: number): string {
  if (!C.options.snacks) return '';
  const list = [...C.at(day, 'Snacks'), ...(day ? C.at(0, 'Snacks') : [])];
  if (!list.length) return '';
  return (
    '<div class="diet-only"><div class="cat">Snacks · dietitian copy, not for residents</div><p class="any">' +
    esc(list.map((x) => dishLong(x.r.name)).join(' · ')) +
    '</p></div>'
  );
}

/** The day's menu by meal. Meals with no specials list the everyday entrées. */
export function dailyMenuHtml(C: PrintContext, day: number): string {
  const o = C.options;
  const d = C.dateOf(day);
  const block = (m: string): string => {
    const L = C.at(day, m);
    if (!L.length) {
      const A = C.at(0, m).filter((x) => x.c === 'Entrees' && !/pureed|molded/i.test(x.r.name));
      return A.length
        ? '<div class="meal"><h2>' +
            m +
            '</h2><p class="any">' +
            esc(
              A.slice(0, 12)
                .map((x) => dishLong(x.r.name))
                .join(' · '),
            ) +
            '</p><p class="note">Served from the à la carte menu every day.</p></div>'
        : '';
    }
    return (
      '<div class="meal"><h2>' +
      m +
      '</h2>' +
      SECTIONS.map(([c, label]) => {
        const I = L.filter((x) => x.c === c);
        return I.length ? '<div class="cat">' + label + '</div>' + I.map((x) => dish(x, o, c === 'Entrees' ? C.sides(day, x.r.id) : [])).join('') : '';
      }).join('') +
      '</div>'
    );
  };
  const cycleMeals = PRINT_MEALS.filter((m) => C.at(day, m).length);
  const everyday = PRINT_MEALS.filter((m) => !C.at(day, m).length)
    .map(block)
    .join('');
  const cy = cycleMeals.map(block);
  const body =
    '<style>.meal,h2{text-align:center}.pair{display:flex;gap:30px}.pair>div{flex:1}</style>' +
    everyday +
    (cy.length === 2 ? '<div class="pair"><div>' + cy[0] + '</div><div>' + cy[1] + '</div></div>' : cy.join('')) +
    '<p class="note" style="text-align:center">The à la carte menu is also available at every meal.</p>' +
    snacksBlock(C, day) +
    FOOT;
  return doc('Daily menu ' + monthDay(d), head(C.venueName, d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })) + body, o);
}

/** Cycle days in week w (0 based). */
export function weekDays(C: PrintContext, w: number): number[] {
  return Array.from({ length: 7 }, (_, i) => w * 7 + i + 1).filter((d) => d <= Math.max(C.len, 1));
}

/** The week at a glance: a landscape table of days by meal. */
export function weekHtml(C: PrintContext, w: number): string {
  const ds = weekDays(C, w);
  const ms = PRINT_MEALS.filter((m) => ds.some((d) => C.at(d, m).length));
  const a = C.dateOf(ds[0]);
  const b = C.dateOf(ds[ds.length - 1]);
  const css =
    '<style>table{width:100%;border-collapse:collapse;table-layout:fixed}th{font:700 10.5px/1.3 -apple-system,system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#fff;background:var(--accent);padding:6px 4px}th span{display:block;font-weight:500;letter-spacing:0;text-transform:none;opacity:.85}td{vertical-align:top;border:1px solid #C9D2DA;padding:8px 7px;font-size:13px;line-height:1.3;height:' +
    (ms.length > 2 ? 1.9 : 2.7) +
    'in}td.m{width:70px;font:700 10px -apple-system,system-ui,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:var(--accent);background:#F0F3F6;vertical-align:middle;text-align:center}.e{font-weight:bold;margin-bottom:7px}.s{font-style:italic;color:#3A4751;margin-bottom:7px}.d{color:#5E6B74;font-style:italic}</style>';
  const cell = (L: PrintLine[], c: PrintCat, cls: string) =>
    L.filter((x) => x.c === c)
      .map((x) => '<div class="' + cls + '">' + esc(dishLong(x.r.name)) + '</div>')
      .join('');
  const rows = ms
    .map(
      (m) =>
        '<tr><td class="m">' +
        m +
        '</td>' +
        ds
          .map((d) => {
            const L = C.at(d, m);
            return '<td>' + cell(L, 'Starters', 's') + cell(L, 'Entrees', 'e') + cell(L, 'Desserts', 'd') + '</td>';
          })
          .join('') +
        '</tr>',
    )
    .join('');
  const heads = ds
    .map(
      (d) =>
        '<th>' +
        C.dateOf(d).toLocaleDateString('en-US', { weekday: 'long' }) +
        '<span>' +
        C.dateOf(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
        '</span></th>',
    )
    .join('');
  return doc(
    'Week at a glance',
    css +
      head(C.venueName + ' · Week at a glance', monthDay(a) + ' to ' + monthDay(b)) +
      '<table><thead><tr><th style="width:70px"></th>' +
      heads +
      '</tr></thead><tbody>' +
      (rows || '<tr><td colspan="8">Nothing is placed on this week yet.</td></tr>') +
      '</tbody></table><p class="note" style="margin-top:8px">Soups in italics, entrées in bold, desserts in grey. The à la carte menu is available at every meal.</p>' +
      FOOT,
    C.options,
    true,
  );
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

/** The Any Day menu: Breakfast, then Lunch and Dinner, in two columns. */
export function alaCarteHtml(C: PrintContext): string {
  const o = C.options;
  const css =
    '<style>.cols{column-count:2;column-gap:28px}.sl{font-size:12.5px;line-height:1.5;margin:0 0 6px}.only{font-weight:normal;font-style:italic;font-size:11.5px;color:#5E6B74}</style>';
  const all = alaCarteItems(C);
  const sec = (title: string, L: typeof all, tag?: (x: (typeof all)[number]) => string) => {
    if (!L.length) return '';
    return (
      '<div class="meal" style="break-inside:auto"><h2>' +
      title +
      '</h2><div class="cols">' +
      SECTIONS.map(([c, label]) => {
        const I = L.filter((e) => e.x.c === c);
        if (!I.length) return '';
        if (c === 'Sides') return '<div class="cat">' + label + '</div><p class="sl">' + esc(I.map((e) => dishLong(e.x.r.name)).join(' · ')) + '</p>';
        return (
          '<div class="cat">' +
          label +
          '</div>' +
          I.map((e) => {
            const res = tabletItem(e.x.r.id)?.residentPrice ?? 0;
            const t = tag?.(e);
            const extra = (res > 0 ? ' <span class="only">+$' + esc(res) + '</span>' : '') + (t ? ' <span class="only">' + esc(t) + '</span>' : '');
            return dish(e.x, o, [], extra);
          }).join('')
        );
      }).join('') +
      '</div></div>'
    );
  };
  const body =
    sec(
      'Breakfast',
      all.filter((e) => e.meals.has('Breakfast')),
    ) +
    sec(
      'Lunch and Dinner',
      all.filter((e) => e.meals.has('Lunch') || e.meals.has('Dinner')),
      (e) => (e.meals.has('Lunch') && e.meals.has('Dinner') ? '' : e.meals.has('Lunch') ? 'lunch only' : 'dinner only'),
    );
  return doc(
    'A la carte menu',
    css +
      head(C.venueName, 'À la carte · available every day') +
      (body || '<p class="note">Nothing is on the à la carte menu yet.</p>') +
      snacksBlock(C, 0) +
      FOOT,
    o,
  );
}

/** The weekly order form for residents who pick up, with tick boxes and lines. */
export function orderFormHtml(C: PrintContext, w: number): string {
  const ds = weekDays(C, w);
  const a = C.dateOf(ds[0]);
  const b = C.dateOf(ds[ds.length - 1]);
  const rng = (m: string) => pickupSpan(C.options.winGrid, C.room, m);
  const css =
    '<style>.f{display:flex;gap:18px;margin:0 0 10px;font:13px -apple-system,system-ui,sans-serif}.f div{flex:1;border-bottom:1px solid #1B2630;padding:14px 0 2px}.f div.w2{flex:2}.how{font:12px/1.45 -apple-system,system-ui,sans-serif;color:#3A4751;margin:0 0 10px}.day{border:1px solid #C9D2DA;border-radius:6px;padding:6px 9px;margin-bottom:7px;break-inside:avoid}.dh{display:flex;justify-content:space-between;font-weight:bold;font-size:13.5px;color:var(--accent);margin-bottom:3px}.dh span{font:11.5px -apple-system,system-ui,sans-serif;color:#3A4751;font-weight:normal}.two{display:flex;gap:16px}.two>div{flex:1}.ml{font:700 9.5px -apple-system,system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#6B7780;margin:2px 0}.o{font-size:12px;line-height:1.55}.bx{display:inline-block;width:11px;height:11px;border:1.3px solid #1B2630;border-radius:2px;margin-right:5px;vertical-align:-1px}.q{display:inline-block;width:22px;border-bottom:1px solid #6B7780;margin-right:5px}</style>';
  const day = (d: number) => {
    const ms = ['Lunch', 'Dinner'].filter((m) => C.at(d, m).length);
    if (!ms.length) return '';
    return (
      '<div class="day"><div class="dh">' +
      C.dateOf(d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) +
      '<span>Pick up range: ' +
      ms.map((m) => m + ' ________').join('  ') +
      '</span></div><div class="two">' +
      ms
        .map(
          (m) =>
            '<div><div class="ml">' +
            m +
            '</div>' +
            C.at(d, m)
              .filter((x) => x.c !== 'Sides')
              .map((x) => '<div class="o"><span class="bx"></span><span class="q"></span>' + esc(dishLong(x.r.name)) + diets(x.r, C.options) + '</div>')
              .join('') +
            '</div>',
        )
        .join('') +
      '</div></div>'
    );
  };
  const lunch = rng('Lunch');
  const dinner = rng('Dinner');
  const ranges =
    lunch && dinner
      ? `Lunch pick up runs ${lunch} and dinner ${dinner}. `
      : lunch
        ? `Lunch pick up runs ${lunch}. `
        : dinner
          ? `Dinner pick up runs ${dinner}. `
          : '';
  return doc(
    'Weekly order form',
    css +
      head(C.venueName + ' · Pick up order form', monthDay(a) + ' to ' + monthDay(b)) +
      '<div class="f"><div class="w2">Name</div><div>Apartment</div><div>Phone</div></div>' +
      '<p class="how">Tick each dish you would like and write how many on the line. Write the 15 minute range you will pick up in, for example 11:30 to 11:45. ' +
      esc(ranges) +
      'Hand the form to a server or leave it at the front desk by 2 PM the day before.</p>' +
      (ds.map(day).join('') || '<p class="note">No lunch or dinner specials are placed on this week yet.</p>') +
      FOOT,
    C.options,
  );
}

/** The week to print: the one asked for, else the week today falls in. */
export function printWeek(C: PrintContext, week?: number | null): number {
  return week != null ? week : C.today ? Math.ceil(C.today / 7) - 1 : 0;
}

export function menuHtml(kind: PrintKind, C: PrintContext, opts: { week?: number | null; day?: number | null } = {}): string {
  const w = printWeek(C, opts.week);
  const day = opts.day || C.today || w * 7 + 1;
  if (kind === 'week') return weekHtml(C, w);
  if (kind === 'alacarte') return alaCarteHtml(C);
  if (kind === 'order') return orderFormHtml(C, w);
  return dailyMenuHtml(C, day);
}
