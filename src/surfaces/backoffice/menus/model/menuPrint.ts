/**
 * Printed menus: four printouts from the menu builder and Menu Export. The
 * day's menu by meal, the week at a glance, the Any Day à la carte menu and
 * the weekly order form for residents who pick up. Letter size unless Menu
 * Export picks another paper; each page is fitted to its paper in the
 * browser (see printFit). Always the full dish name, and every value is
 * escaped.
 */
import { COMMUNITY_NAME } from '../../../../data';
import type { GridEntry, Recipe, VenueSchedule } from '../../../../store/menuEdits';
import type { BoState } from './types';
import { normCategory } from './categories';
import { addDays, cycleDayOn, dayStart, menuAnchor, venuesAt, type CycleAnchor } from '../../../../domain/menuCycle';
import { venueServing } from '../../../../store/venueMenu';
import { tabletItem } from './tablet';
import {
  alaCarteDoc,
  alaCarteItems,
  alaCarteMeals,
  dailyDoc,
  everydayEntrees,
  FOOT_LINES,
  menuDoc,
  orderDoc,
  PRINT_MEALS,
  printWeek,
  snackLines,
  weekDays,
  weekDoc,
  pickedMeals,
  type DocBlock,
  type DocItem,
  type DocSheet,
  type MenuDoc,
  type MenuPick,
} from './menuDoc';

export { alaCarteItems, alaCarteMeals, printMeals, printWeek, RAW_FOOD_NOTICE, weekDays, type MenuPick } from './menuDoc';

export type PrintKind = 'daily' | 'week' | 'alacarte' | 'order';
export type TemplateId = 'classic' | 'coastal' | 'bistro';

export const TEMPLATES: Array<{ id: TemplateId; name: string; use: string }> = [
  { id: 'classic', name: 'Classic Serif', use: 'Kisco standard' },
  { id: 'coastal', name: 'Coastal Light', use: 'Signature venues' },
  { id: 'bistro', name: 'Bistro Card', use: 'casual venues' },
];

export type PaperId = 'letter' | 'legal' | 'half' | 'tabloid' | 'a4';

/** Paper sizes in inches, portrait, with the margin all round. */
export interface Paper {
  id: PaperId;
  name: string;
  w: number;
  h: number;
  margin: number;
}

export const PAPERS: Paper[] = [
  { id: 'letter', name: 'Letter 8.5 × 11', w: 8.5, h: 11, margin: 0.5 },
  { id: 'legal', name: 'Legal 8.5 × 14', w: 8.5, h: 14, margin: 0.5 },
  { id: 'half', name: 'Half letter 5.5 × 8.5', w: 5.5, h: 8.5, margin: 0.35 },
  { id: 'tabloid', name: 'Tabloid 11 × 17', w: 11, h: 17, margin: 0.6 },
  { id: 'a4', name: 'A4 210 × 297 mm', w: 8.27, h: 11.69, margin: 0.5 },
];

/** A paper by id; letter for anything unknown. */
export function paperOf(id: string | null | undefined): Paper {
  return PAPERS.find((p) => p.id === id) ?? PAPERS[0];
}

/** Page width and height in inches, turned for landscape. */
export function pageSize(p: Paper, landscape = false): { w: number; h: number } {
  return landscape ? { w: p.h, h: p.w } : { w: p.w, h: p.h };
}

/** The printable area of a page in inches: the page less its margins. */
export function printArea(p: Paper, landscape = false): { w: number; h: number } {
  const { w, h } = pageSize(p, landscape);
  return { w: +(w - 2 * p.margin).toFixed(2), h: +(h - 2 * p.margin).toFixed(2) };
}

/**
 * The page rule for a paper (`@page { size: 5.5in 8.5in }`), each sheet as
 * wide as the printable area and a page tall, one sheet per page.
 */
export function paperCss(p: Paper, landscape = false): string {
  const { w, h } = pageSize(p, landscape);
  const a = printArea(p, landscape);
  const m = p.margin;
  return (
    `@page{size:${w}in ${h}in;margin:${m}in}` +
    `.sheet{width:${a.w}in;position:relative}.fit{min-height:${+(a.h - 0.06).toFixed(2)}in}` +
    '@media print{.sheet{break-after:page}.sheet:last-child{break-after:auto}}' +
    // On screen (the preview) the margin is padding, and each sheet starts where its page would.
    `@media screen{html{padding:${m}in;background:#fff}.sheet+.sheet{margin-top:${2 * m}in}` +
    `.sheet+.sheet::before{content:"";position:absolute;left:-${m}in;right:-${m}in;top:-${m}in;border-top:1px dashed #C9D2DA}}`
  );
}

export type PrintCat = 'Starters' | 'Entrees' | 'Sides' | 'Desserts' | 'Drinks';

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
  /** Paper size (Menu Export); letter when unset. */
  paper?: PaperId;
  /** The date printed: a venue's menu and cycle day are the ones it serves on this date. */
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

/** The dining room the venue's tablets belong to (for pick up ranges): its kitchen in Venue Settings. */
export function venueRoom(v: Pick<VenueSchedule, 'room'> | undefined): string {
  return v?.room ?? 'sequoia';
}

export function printContext(bo: BoState, o: PrintOptions, sidesOf: (menuId: string, day: number, recipeId: string) => string[]): PrintContext {
  const venues = venuesAt(bo.venues, o.at);
  const v =
    venues.find((x) => x.id === o.venueId) ??
    venues.find((x) => x.active && (x.menuId === o.menuId || x.alcMenuId === o.menuId)) ??
    venues.find((x) => x.active && (x.menuId || x.alcMenuId));
  // Printing for a venue: its menu and cycle day on the date, worked out as the floor does.
  const raw = !o.menuId && v ? bo.venues.find((x) => x.id === v.id) : undefined;
  const serving = raw ? venueServing(raw, o.at, bo.menus, bo.grid) : null;
  const menuId = serving
    ? (serving.cycleId ?? serving.alcId?.replace(/:everyday$/, '') ?? null)
    : (o.menuId ?? v?.menuId ?? v?.alcMenuId?.replace(/:everyday$/, '') ?? null);
  const menu = bo.menus.find((m) => m.id === menuId);
  let last = 0;
  for (const g of bo.grid) if (g.menuId === menuId && g.day > last) last = g.day;
  const t0 = dayStart(o.at);
  let len: number;
  let today: number;
  let start: Date;
  if (serving) {
    len = serving.len;
    today = serving.day;
    start = addDays(t0, 1 - (today || 1));
  } else {
    len = menu && menu.kind === 'cycle' ? Math.max(menu.cycleLen || 0, last) : 0;
    const live = len > 0 && !!v && v.menuId === menuId && v.menuStartDt != null && dayStart(v.menuStartDt) <= t0;
    const anchor = o.anchor ?? (menu ? menuAnchor(menu, venues, len, o.at) : null);
    today = live && v ? (cycleDayOn(v.menuStartDt, len, o.at) ?? 1) : anchor?.live ? (anchor.today ?? 0) : 0;
    start = anchor ? anchor.start : live ? addDays(t0, 1 - today) : t0;
  }
  const recipes = new Map(bo.recipes.map((r) => [r.id, r]));
  return {
    venueName: v?.name ?? 'Dining Room',
    room: venueRoom(v),
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

/** A vertical gap that stretches with the page's fit (--sp, see printFit). */
const sp = (px: number) => `calc(${px}px*var(--sp))`;
const SANS = '-apple-system,system-ui,sans-serif';

const BASE_CSS =
  '*{box-sizing:border-box}body{color:#1B2630;margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
  `.fit{--sp:1;display:flex;flex-direction:column}.push{flex:1 0 auto;min-height:${sp(14)}}` +
  `.hd{text-align:center;border-bottom:2px solid var(--accent);padding-bottom:${sp(9)};margin-bottom:${sp(14)}}.brand{font-size:28px;line-height:1.2;letter-spacing:.05em;color:var(--accent)}` +
  `.kick{font:700 10px/1.3 ${SANS};letter-spacing:.2em;text-transform:uppercase;color:#6B7780}.ttl{font-size:17px;margin-top:${sp(5)}}` +
  `.ft{padding-top:${sp(7)};border-top:1px solid #C9D2DA;font:10.5px/1.45 ${SANS};color:#5E6B74;text-align:center}` +
  `h2{font-size:18px;font-weight:normal;color:var(--accent);letter-spacing:.06em;text-transform:uppercase;margin:0 0 ${sp(6)};border-bottom:1px solid #C9D2DA;padding-bottom:3px}` +
  `.cat{font:700 10px/1.3 ${SANS};letter-spacing:.14em;text-transform:uppercase;color:#6B7780;margin:${sp(10)} 0 ${sp(3)}}` +
  `.it{margin:0 0 ${sp(7)};break-inside:avoid;line-height:calc(1.1 + .12*var(--sp))}.nm{font-size:14.5px;font-weight:bold}.ds{font-size:12.5px;font-style:italic;color:#3A4751}.sd{font-size:12.5px;color:#3A4751}` +
  `.dt{font:600 9.5px ${SANS};color:#4F6A38;border:1px solid #B9CBA6;border-radius:8px;padding:0 5px;margin-left:5px;vertical-align:2px;white-space:nowrap}` +
  `.meal{margin-bottom:${sp(16)};break-inside:avoid}.any{font-size:13px;line-height:calc(1.2 + .15*var(--sp));margin:${sp(4)} 0}.note{font:11.5px ${SANS};color:#6B7780;margin:${sp(3)} 0}` +
  `.diet-only{border:1px dashed #A8703B;border-radius:6px;padding:${sp(6)} 10px;margin-top:${sp(10)}}` +
  '.ctr .meal,.ctr h2,.ctr .note{text-align:center}.pair{display:flex;gap:30px}.pair>div{flex:1}' +
  `.cols{column-count:2;column-gap:28px}.sl{font-size:12.5px;line-height:1.5;margin:0 0 ${sp(6)}}.only{font-weight:normal;font-style:italic;font-size:11.5px;color:#5E6B74}`;

const WEEK_CSS =
  `table{width:100%;border-collapse:collapse;table-layout:fixed;flex:1 0 auto}th{font:700 10.5px/1.3 ${SANS};letter-spacing:.08em;text-transform:uppercase;color:#fff;background:var(--accent);padding:6px 4px}th span{display:block;font-weight:500;letter-spacing:0;text-transform:none;opacity:.85}` +
  `td{vertical-align:top;border:1px solid #C9D2DA;padding:${sp(8)} 7px;font-size:13px;line-height:1.3}td.m{width:70px;font:700 10px ${SANS};letter-spacing:.1em;text-transform:uppercase;color:var(--accent);background:#F0F3F6;vertical-align:middle;text-align:center}` +
  `.e{font-weight:bold;margin-bottom:${sp(7)}}.s{font-style:italic;color:#3A4751;margin-bottom:${sp(7)}}.d{color:#5E6B74;font-style:italic}.wk{margin-top:${sp(8)}}`;

const ORDER_CSS =
  `.f{display:flex;gap:18px;margin:0 0 ${sp(10)};font:13px ${SANS}}.f div{flex:1;border-bottom:1px solid #1B2630;padding:14px 0 2px}.f div.w2{flex:2}.how{font:12px/1.45 ${SANS};color:#3A4751;margin:0 0 ${sp(10)}}` +
  `.day{border:1px solid #C9D2DA;border-radius:6px;padding:${sp(6)} 9px;margin-bottom:${sp(7)};break-inside:avoid}.dh{display:flex;justify-content:space-between;font-weight:bold;font-size:13.5px;color:var(--accent);margin-bottom:${sp(3)}}.dh span{font:11.5px ${SANS};color:#3A4751;font-weight:normal}` +
  `.two{display:flex;gap:16px}.two>div{flex:1}.ml{font:700 9.5px ${SANS};letter-spacing:.12em;text-transform:uppercase;color:#6B7780;margin:2px 0}.o{font-size:12px;line-height:calc(1.35 + .2*var(--sp))}` +
  '.bx{display:inline-block;width:11px;height:11px;border:1.3px solid #1B2630;border-radius:2px;margin-right:5px;vertical-align:-1px}.q{display:inline-block;width:22px;border-bottom:1px solid #6B7780;margin-right:5px}';

const FOOT = '<div class="push"></div><div class="ft">' + FOOT_LINES.map(esc).join('<br>') + '</div>';

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

const dietTags = (ds: string[]) => ds.map((d) => '<span class="dt">' + esc(d) + '</span>').join('');

function dish(x: DocItem): string {
  return (
    '<div class="it"><div class="nm">' +
    esc(x.name) +
    x.tags.map((t) => ' <span class="only">' + esc(t) + '</span>').join('') +
    dietTags(x.diets) +
    '</div>' +
    (x.desc ? '<div class="ds">' + esc(x.desc) + '</div>' : '') +
    (x.sides ? '<div class="sd">Served with ' + esc(andList(x.sides)) + '</div>' : '') +
    '</div>'
  );
}

const blk = (i: number) => ' data-blk="' + i + '"';

function block(b: DocBlock, i: number): string {
  switch (b.t) {
    case 'meal':
      return (
        '<div class="meal"' +
        blk(i) +
        '><h2>' +
        esc(b.title) +
        '</h2>' +
        b.cats.map((c) => '<div class="cat">' + esc(c.label) + '</div>' + c.items.map(dish).join('')).join('') +
        '</div>'
      );
    case 'list':
      return (
        '<div class="meal"' +
        blk(i) +
        '><h2>' +
        esc(b.title) +
        '</h2><p class="any">' +
        esc(b.names.join(' · ')) +
        '</p><p class="note">' +
        esc(b.note) +
        '</p></div>'
      );
    case 'note':
      return '<p class="note"' + blk(i) + '>' + esc(b.text) + '</p>';
    case 'snacks':
      return (
        '<div class="diet-only"' +
        blk(i) +
        '><div class="cat">Snacks · dietitian copy, not for residents</div><p class="any">' +
        esc(b.names.join(' · ')) +
        '</p></div>'
      );
    case 'week': {
      const rows = b.rows
        .map(
          (r) =>
            '<tr><td class="m">' +
            esc(r.meal) +
            '</td>' +
            r.cells.map((c) => '<td>' + c.map((x) => '<div class="' + x.k + '">' + esc(x.name) + '</div>').join('') + '</td>').join('') +
            '</tr>',
        )
        .join('');
      return (
        '<table' +
        blk(i) +
        '><thead><tr><th style="width:70px"></th>' +
        b.heads.map(([d, md]) => '<th>' + esc(d) + '<span>' + esc(md) + '</span></th>').join('') +
        '</tr></thead><tbody>' +
        (rows || '<tr><td colspan="8">Nothing is placed on this week yet.</td></tr>') +
        '</tbody></table><p class="note wk">' +
        esc(b.note) +
        '</p>'
      );
    }
    case 'orderTop':
      return '<div class="f"><div class="w2">Name</div><div>Apartment</div><div>Phone</div></div><p class="how">' + esc(b.how) + '</p>';
    case 'orderDay':
      return (
        '<div class="day"' +
        blk(i) +
        '><div class="dh">' +
        esc(b.date) +
        '<span>Pick up range: ' +
        b.meals.map((m) => esc(m.meal) + ' ________').join('  ') +
        '</span></div><div class="two">' +
        b.meals
          .map(
            (m) =>
              '<div><div class="ml">' +
              esc(m.meal) +
              '</div>' +
              m.items
                .map((x) => '<div class="o"><span class="bx"></span><span class="q"></span>' + esc(x.name) + dietTags(x.diets) + '</div>')
                .join('') +
              '</div>',
          )
          .join('') +
        '</div></div>'
      );
  }
}

/** À la carte: consecutive courses of a section share its heading and two columns. */
function sections(blocks: DocBlock[]): string {
  let out = '';
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i];
    if (b.t !== 'meal' || !b.sec) {
      out += block(b, i++);
      continue;
    }
    let inner = '';
    const start = b;
    while (i < blocks.length) {
      const c = blocks[i];
      if (c.t !== 'meal' || c.sec !== start.sec) break;
      inner +=
        '<div' +
        blk(i) +
        '>' +
        c.cats
          .map(
            (k) =>
              // A course carried on from the page before is named again.
              (k.cont && c !== start ? '' : '<div class="cat">' + esc(k.label + (k.cont ? ', continued' : '')) + '</div>') +
              (k.line ? '<p class="sl">' + esc(k.items.map((x) => x.name).join(' · ')) + '</p>' : k.items.map(dish).join('')),
          )
          .join('') +
        '</div>';
      i++;
    }
    out +=
      '<div class="meal" style="break-inside:auto"><h2>' +
      esc(start.sec + (start.first ? '' : ', continued')) +
      '</h2><div class="cols">' +
      inner +
      '</div></div>';
  }
  return out;
}

function sheetBody(s: DocSheet): string {
  if (!s.pair) return sections(s.blocks);
  // Two cycle meals side by side, where the first of them would be.
  const idx = s.blocks.flatMap((b, i) => (b.t === 'meal' && b.cycle ? [i] : []));
  if (idx.length !== 2) return sections(s.blocks);
  return s.blocks
    .map((b, i) =>
      i === idx[0]
        ? '<div class="pair"><div>' + block(b, i) + '</div><div>' + block(s.blocks[idx[1]], idx[1]) + '</div></div>'
        : i === idx[1]
          ? ''
          : block(b, i),
    )
    .join('');
}

/** A menu document as a printable page: one `.sheet` per printed page. */
export function docHtml(d: MenuDoc, o: PrintOptions): string {
  const extra = d.kind === 'week' ? WEEK_CSS : d.kind === 'order' ? ORDER_CSS : '';
  return (
    '<!doctype html><html><head><meta charset="utf-8"><title>' +
    esc(d.title) +
    '</title><style>' +
    paperCss(paperOf(o.paper), d.landscape) +
    BASE_CSS +
    extra +
    TEMPLATE_CSS[o.template ?? 'classic'] +
    '</style></head><body' +
    (d.centered ? ' class="ctr"' : '') +
    '>' +
    d.sheets
      .map((s, i) => '<div class="sheet" data-i="' + i + '"><div class="fit">' + head(s.kicker, s.title) + sheetBody(s) + FOOT + '</div></div>')
      .join('') +
    '</body></html>'
  );
}

/** The day's menu by meal (see dailyDoc). */
export function dailyMenuHtml(C: PrintContext, day: number, meals: string[] = []): string {
  return docHtml(dailyDoc(C, day, meals), C.options);
}

/** The week at a glance: a landscape table of days by meal. */
export function weekHtml(C: PrintContext, w: number): string {
  return docHtml(weekDoc(C, w), C.options);
}

/** The Any Day menu (see alaCarteDoc). */
export function alaCarteHtml(C: PrintContext, opts: MenuPick = {}): string {
  return docHtml(alaCarteDoc(C, opts), C.options);
}

/** The weekly order form for residents who pick up, with tick boxes and lines. */
export function orderFormHtml(C: PrintContext, w: number): string {
  return docHtml(orderDoc(C, w), C.options);
}

/**
 * The dishes a printout lists, each once: what the preview counts, so the
 * count matches what prints.
 */
export function printedRecipes(kind: PrintKind, C: PrintContext, opts: MenuPick = {}): Set<string> {
  const w = printWeek(C, opts.week);
  const day = opts.day || C.today || w * 7 + 1;
  const ids = new Set<string>();
  const add = (L: PrintLine[]) => L.forEach((x) => ids.add(x.r.id));
  if (kind === 'alacarte') {
    const picked = pickedMeals(opts.meals, alaCarteMeals(C));
    add(
      alaCarteItems(C)
        .filter((e) => !picked.length || picked.some((m) => e.meals.has(m)))
        .map((e) => e.x),
    );
    if (C.options.snacks) add(snackLines(C, 0));
  } else if (kind === 'week') {
    for (const d of weekDays(C, w))
      for (const m of PRINT_MEALS) add(C.at(d, m).filter((x) => x.c === 'Starters' || x.c === 'Entrees' || x.c === 'Desserts'));
  } else if (kind === 'order') {
    for (const d of weekDays(C, w)) for (const m of ['Lunch', 'Dinner']) add(C.at(d, m).filter((x) => x.c !== 'Sides'));
  } else {
    const noCycle = C.len === 0;
    const picked: readonly string[] = opts.meals?.length ? opts.meals : PRINT_MEALS;
    for (const m of PRINT_MEALS) {
      if (!picked.includes(m)) continue;
      const L = C.at(noCycle ? 0 : day, m);
      add(L.length ? L : noCycle ? [] : everydayEntrees(C, m));
    }
    if (opts.meals?.includes('Snacks') || (!opts.meals?.length && C.options.snacks)) add(snackLines(C, day));
  }
  return ids;
}

export function menuHtml(kind: PrintKind, C: PrintContext, opts: MenuPick = {}): string {
  return docHtml(menuDoc(kind, C, opts), C.options);
}
