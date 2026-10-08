import { afterEach, describe, expect, it } from 'vitest';
import * as docx from 'docx';
import JSZip from 'jszip';
import { now } from '../../../../lib/clock';
import type { Recipe } from '../../../../store/menuEdits';
import { getBo, placementSides, resetMenuEdits, updateBo } from '../data';
import { DIETS } from '../model/categories';
import { dietIcon, dietOrder, dietSvg } from '../model/dietIcons';
import { alaCarteDoc, dailyDoc, orderDoc, sheetDiets, splitUnits, weekDoc, type DocSheet, type MenuDoc } from '../model/menuDoc';
import { menuWordDoc, type WPara } from '../model/menuDocx';
import { docHtml, paperOf, printContext, printWeek, type PrintOptions } from '../model/menuPrint';
import { menuPrices, money, printedPrice, setPrice, venuePrices } from '../model/pricing';
import { isUpchargeRecipe, tabletItem } from '../model/tablet';
import { buildDocx, wordIconDiets } from '../ui/wordExport';

afterEach(() => resetMenuEdits());

const ctx = (venueId: string, extra: Partial<PrintOptions> = {}) =>
  printContext(getBo(), { venueId, at: now(), diet: true, ...extra }, (m, d, r) => placementSides(getBo(), m, d, r).sides);

const recipe = (id: string) => getBo().recipes.find((r) => r.id === id)!;
/** A tablet dish with a guest price, and an add-on sold on top of a dish. */
const priced = () => getBo().recipes.find((r) => (tabletItem(r.id)?.guestPrice ?? 0) > 0 && !isUpchargeRecipe(r.id))!;
const addOn = () => getBo().recipes.find((r) => isUpchargeRecipe(r.id) && (tabletItem(r.id)?.guestPrice ?? 0) > 0)!;

describe('menu prices per venue', () => {
  it("uses the menu price unless the venue set its own, and only that venue's", () => {
    const r = priced();
    const base = menuPrices(r);
    const rows = setPrice([], 'v1', r, 'guest', 99.5);
    expect(venuePrices(rows, 'v1', r)).toEqual({ ...base, guest: 99.5 });
    expect(venuePrices(rows, 'v2', r)).toEqual(base);
    expect(venuePrices(rows, null, r)).toEqual(base);
  });
  it('prints a price, "+" for an add-on, and nothing for no price', () => {
    expect(money(12.5)).toBe('$12.50');
    expect(printedPrice({ res: 0, guest: 12.5, ala: 14 }, 'guest')).toBe('$12.50');
    expect(printedPrice({ res: 0, guest: 12.5, ala: 14 }, 'ala')).toBe('$14.00');
    expect(printedPrice({ res: 4, guest: 4, ala: 4 }, 'res', true)).toBe('+$4.00');
    // Included in the meal plan, or never priced: nothing, never "$0.00".
    expect(printedPrice({ res: 0, guest: 12.5, ala: 14 }, 'res')).toBeUndefined();
    expect(printedPrice({ res: null, guest: null, ala: null }, 'guest')).toBeUndefined();
  });
  it("prints each dish at the chosen venue's price, when prices are on", () => {
    const r = priced();
    expect(ctx('v1').price(r)).toBeUndefined();
    expect(ctx('v1', { prices: 'guest' }).price(r)).toBe(money(tabletItem(r.id)!.guestPrice));
    expect(ctx('v1', { prices: 'ala' }).price(r)).toBe(money(tabletItem(r.id)!.alaPrice));
    updateBo((s) => ({ prices: setPrice(s.prices, 'v1', r, 'guest', 21) }));
    expect(ctx('v1', { prices: 'guest' }).price(r)).toBe('$21.00');
    expect(ctx('v2', { prices: 'guest' }).price(r)).toBe(money(tabletItem(r.id)!.guestPrice));
    expect(ctx('v1', { prices: 'guest' }).price(addOn())).toMatch(/^\+\$\d+\.\d\d$/);
    // A recipe Back Office made with no price prints none.
    expect(ctx('v1', { prices: 'guest' }).price({ ...recipe(r.id), id: 'new-dish', price: undefined } as Recipe)).toBeUndefined();
  });
  it('puts prices on the daily, à la carte and order form, not the week at a glance', () => {
    const C = ctx('v1', { prices: 'guest' });
    const day = dailyDoc(C, C.today);
    const items = day.sheets[0].blocks.flatMap((b) => (b.t === 'meal' ? b.cats.flatMap((c) => c.items) : []));
    expect(items.some((x) => x.price)).toBe(true);
    expect(items.every((x) => !x.price || /^\+?\$\d+\.\d\d$/.test(x.price))).toBe(true);
    expect(day.priceNote).toBe('Guest prices');
    const html = docHtml(day, C.options);
    expect(html).toContain('<span class="pr">' + items.find((x) => x.price)!.price + '</span>');
    expect(html).toContain('<div class="lg"><span>Guest prices</span></div>');
    expect(html).not.toContain('$0.00');
    expect(weekDoc(C, 0).priceNote).toBeUndefined();
    const order = orderDoc(C, printWeek(C));
    const priced = order.sheets[0].blocks.flatMap((b) => (b.t === 'orderDay' ? b.meals.flatMap((m) => m.items) : [])).filter((x) => x.price);
    expect(priced.length).toBeGreaterThan(0);
    expect(docHtml(order, C.options)).toContain('<span class="ld"></span><span class="pr">');
    // À la carte: prices replace the resident upcharge note, so a price never shows twice.
    const alc = alaCarteDoc(C);
    const alcItems = alc.sheets[0].blocks.flatMap((b) => (b.t === 'meal' ? b.cats.flatMap((c) => c.items) : []));
    expect(alcItems.some((x) => x.price?.startsWith('+'))).toBe(true);
    expect(alcItems.some((x) => x.tags.some((t) => t.startsWith('+$')))).toBe(false);
    expect(
      alaCarteDoc(ctx('v1')).sheets[0].blocks.some(
        (b) => b.t === 'meal' && b.cats.some((c) => c.items.some((x) => x.tags.some((t) => t.startsWith('+$')))),
      ),
    ).toBe(true);
  });
});

describe('diet icons', () => {
  it('draws every Recipe Book diet, and a ring with its letters for any other', () => {
    for (const d of DIETS) expect(dietIcon(d).shapes).not.toContain('<text');
    expect(dietIcon('Vegetarian').short).toBe('V');
    expect(dietIcon('Gluten-Friendly').short).toBe('GF');
    const other = dietIcon('Low Sugar <b>');
    expect(other.short).toBe('LS');
    expect(other.shapes).toContain('<text');
    // In the text colour (black and grey on paper), never a colour of its own.
    const svg = dietSvg('Vegetarian', { cls: 'di' });
    expect(svg).toContain('stroke="currentColor"');
    expect(svg).toContain('aria-label="Vegetarian"');
    expect(dietSvg('Low Sugar <b>')).not.toContain('<b>');
  });
  it('orders diets as the Recipe Book does, each once', () => {
    expect(dietOrder(['Vegetarian', 'Heart-Healthy', 'Gluten-Friendly', 'Vegetarian', 'Low Sugar'])).toEqual([
      'Gluten-Friendly',
      'Vegetarian',
      'Heart-Healthy',
      'Low Sugar',
    ]);
  });
  it("lists only the icons on each page in that page's legend", () => {
    const C = ctx('v1', { dietIcons: true });
    const sheet = (diets: string[][]): DocSheet => ({
      kicker: 'k',
      title: 't',
      blocks: [{ t: 'meal', title: 'Lunch', cats: [{ label: 'Entrées', items: diets.map((d, i) => ({ name: 'Dish ' + i, diets: d, tags: [] })) }] }],
    });
    const doc: MenuDoc = {
      kind: 'daily',
      title: 'x',
      landscape: false,
      centered: true,
      icons: true,
      sheets: [sheet([['Vegetarian'], ['Heart-Healthy', 'Vegetarian']]), sheet([['Gluten-Friendly'], []])],
    };
    expect(sheetDiets(doc.sheets[0])).toEqual(['Vegetarian', 'Heart-Healthy']);
    const pages = docHtml(doc, C.options).split('<div class="sheet"').slice(1);
    const legend = (p: string) => [...(p.match(/<div class="lg">.*?<\/div>/)?.[0] ?? '').matchAll(/aria-label="([^"]+)"/g)].map((m) => m[1]);
    expect(legend(pages[0])).toEqual(['Vegetarian', 'Heart-Healthy']);
    expect(legend(pages[1])).toEqual(['Gluten-Friendly']);
    // Words print as before, with no legend.
    expect(docHtml({ ...doc, icons: false }, C.options)).not.toContain('class="lg"');
    expect(docHtml({ ...doc, icons: false }, C.options)).toContain('<span class="dt">Vegetarian</span>');
  });
  it('fits with prices and icons on: same blocks to split, legend measured inside the page', () => {
    const plain = ctx('v1');
    const both = ctx('v1', { dietIcons: true, prices: 'guest' });
    const a = dailyDoc(plain, plain.today);
    const b = dailyDoc(both, both.today);
    expect(b.icons).toBe(true);
    expect(splitUnits(b.sheets[0].blocks)).toEqual(splitUnits(a.sheets[0].blocks));
    // The legend sits inside the fitted page, above the footer, so the fit measures it.
    const html = docHtml(b, both.options);
    expect(html).toMatch(/<div class="fit">.*<div class="push"><\/div><div class="lg">.*<\/div><div class="ft">/);
  });
});

describe('Word export with prices and icons', () => {
  const C = () => ctx('v1', { dietIcons: true, prices: 'guest' });
  const paras = (w: ReturnType<typeof menuWordDoc>): WPara[] => w.body.flatMap((x) => (x.k === 'p' ? [x] : x.rows.flat().flatMap((c) => c.paras)));

  it('marks diet icons, prices and the legend', () => {
    const c = C();
    const order = orderDoc(c, printWeek(c));
    const w = menuWordDoc(order, paperOf('letter'), []);
    const icons = wordIconDiets(w);
    expect(icons.length).toBeGreaterThan(0);
    expect(new Set(icons).size).toBe(icons.length);
    const tabbed = paras(w).filter((p) => p.tabRight);
    expect(tabbed.length).toBeGreaterThan(0);
    expect(tabbed.every((p) => p.runs.at(-1)!.tab && /^\$\d+\.\d\d$/.test(p.runs.at(-1)!.text))).toBe(true);
    // The legend, over the footer: every icon on the page with its name, then which prices.
    const legend = paras(w).find((p) => p.runs.some((r) => r.text === 'Guest prices' || r.text.endsWith('Guest prices')))!;
    expect(legend.runs.filter((r) => r.icon).map((r) => r.icon)).toEqual(sheetDiets(order.sheets[0]));
  });
  it('puts the drawings in the file, or letters where there are none', async () => {
    const c = C();
    const w = menuWordDoc(orderDoc(c, printWeek(c)), paperOf('letter'), []);
    const fake = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const icons = Object.fromEntries(
      wordIconDiets(w).map((d) => [d, { svg: new TextEncoder().encode(dietSvg(d, { color: '#3A4751' })), png: fake }]),
    );
    const zip = await JSZip.loadAsync(await docx.Packer.toBuffer(buildDocx(w, docx, icons)));
    const files = Object.keys(zip.files);
    expect(files.some((f) => /^word\/media\/.*\.svg$/.test(f))).toBe(true);
    expect(files.some((f) => /^word\/media\/.*\.png$/.test(f))).toBe(true);
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).toMatch(/<w:tab w:val="right" w:pos="\d+" w:leader="dot"\/>/);
    // No drawings: each icon keeps its letters, so the legend still explains it.
    const plain = await JSZip.loadAsync(await docx.Packer.toBuffer(buildDocx(w, docx)));
    expect(Object.keys(plain.files).some((f) => f.startsWith('word/media/'))).toBe(false);
    const text = await plain.file('word/document.xml')!.async('string');
    expect(text).toContain('>' + dietIcon(wordIconDiets(w)[0]).short + '</w:t>');
  });
});
