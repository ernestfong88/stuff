import { afterEach, describe, expect, it } from 'vitest';
import * as docx from 'docx';
import JSZip from 'jszip';
import { now } from '../../../../lib/clock';
import { getBo, placementSides, resetMenuEdits } from '../data';
import { alaCarteDoc, COURSE_PIECE, dailyDoc, splitDoc, splitSheet, splitUnits, type DocBlock, type DocSheet } from '../model/menuDoc';
import { menuWordDoc, PT, WORD_SCALE, wordFileName, type WPara } from '../model/menuDocx';
import { alaCarteMeals, docHtml, menuHtml, paperOf, printContext, printedRecipes } from '../model/menuPrint';
import { FILL, fitCss, fitPlan, readableZoom, refineZoom, SPACE_MAX, SPACE_MIN, splitAt, ZOOM_MAX } from '../model/printFit';
import { buildDocx } from '../ui/wordExport';

afterEach(() => resetMenuEdits());

const ctx = (venueId: string, extra: object = {}) =>
  printContext(getBo(), { venueId, at: now(), diet: true, ...extra }, (m, d, r) => placementSides(getBo(), m, d, r).sides);

describe('fitting a page', () => {
  it('opens the spacing first on a short page, then grows the type, within caps', () => {
    // 650 of text and 100 of spacing on a 1000 page: spacing opens to its cap, then the type grows.
    const f = fitPlan(650, 100, 1000);
    expect(f.space).toBe(SPACE_MAX);
    expect(f.zoom).toBeCloseTo((1000 * FILL) / (650 + 100 * SPACE_MAX), 2);
    expect(f.zoom).toBeLessThanOrEqual(ZOOM_MAX);
    // A little short: only the spacing opens.
    const g = fitPlan(850, 100, 1000);
    expect(g.zoom).toBe(1);
    expect(g.space).toBeCloseTo((975 - 850) / 100, 3);
    // Almost nothing on the page: the type stops at its cap.
    expect(fitPlan(100, 10, 1000).zoom).toBe(ZOOM_MAX);
  });
  it('tightens the spacing first on a long page, then shrinks the type', () => {
    const f = fitPlan(800, 200, 1000);
    expect(f.zoom).toBe(1);
    expect(f.space).toBeCloseTo((975 - 800) / 200, 3);
    const g = fitPlan(1100, 200, 1000);
    expect(g.space).toBe(SPACE_MIN);
    expect(g.zoom).toBeCloseTo(975 / (1100 + 200 * SPACE_MIN), 2);
    // Fitted height is never over the page.
    for (const [t, s] of [
      [500, 50],
      [1500, 300],
      [990, 0],
    ])
      expect(fitPlan(t, s, 1000).zoom * (t + s * fitPlan(t, s, 1000).space)).toBeLessThanOrEqual(1000);
  });
  it('flags a page whose type would drop below the reading floor', () => {
    expect(readableZoom()).toBeCloseTo(8.5 / (12.5 * 0.75), 3);
    expect(fitPlan(1000, 100, 1000).readable).toBe(true);
    expect(fitPlan(1500, 100, 1000).readable).toBe(false);
  });
  it('corrects the zoom by what the page measured', () => {
    expect(refineZoom(1, 1000 * FILL, 1000)).toBe(1);
    expect(refineZoom(1, 1100, 1000)).toBeCloseTo(975 / 1100, 3);
    expect(refineZoom(1, 800, 1000)).toBeCloseTo(975 / 800, 3);
    expect(refineZoom(1.2, 500, 1000)).toBe(ZOOM_MAX);
  });
  it('writes each page fit into the page', () => {
    const css = fitCss(
      [
        { zoom: 0.9, space: 0.7, readable: true },
        { zoom: 1.1, space: 1.5, readable: true },
      ],
      10,
    );
    expect(css).toContain('.sheet[data-i="0"]>.fit{zoom:0.9;--sp:0.7;min-height:11.044in}');
    expect(css).toContain('.sheet[data-i="1"]>.fit{zoom:1.1;--sp:1.5');
  });
});

describe('splitting a page in two', () => {
  it('balances the two pages by height, in order', () => {
    expect(splitAt([100, 100, 100, 100])).toBe(2);
    expect(splitAt([300, 50, 50, 50, 50])).toBe(1);
    expect(splitAt([50, 50, 50, 50, 300])).toBe(4);
    expect(splitAt([100])).toBe(1);
    expect(splitAt([])).toBe(0);
  });
  it('keeps a note with the block above it and never splits a single block', () => {
    const meal = (title: string): DocBlock => ({ t: 'meal', title, cats: [] });
    const sheet: DocSheet = {
      kicker: 'k',
      title: 't',
      pair: true,
      blocks: [meal('Breakfast'), meal('Lunch'), meal('Dinner'), { t: 'note', text: 'also', glue: true }],
    };
    expect(splitUnits(sheet.blocks)).toEqual([[0], [1], [2, 3]]);
    const [a, b] = splitSheet(sheet, [100, 300, 250, 20]);
    expect(a.blocks.map((x) => (x.t === 'meal' ? x.title : x.t))).toEqual(['Breakfast', 'Lunch']);
    expect(b.blocks.map((x) => (x.t === 'meal' ? x.title : x.t))).toEqual(['Dinner', 'note']);
    expect(a.pair).toBe(false);
    expect(splitSheet({ ...sheet, blocks: [meal('Lunch')] }, [5000])).toHaveLength(1);
  });
  it('puts a daily menu too long to read on one page onto two, each with its header and footer', () => {
    const C = ctx('v1');
    const doc = dailyDoc(C, C.today);
    expect(doc.sheets).toHaveLength(1);
    const n = doc.sheets[0].blocks.length;
    // As the fitter does: unreadable on one page, so split by the measured heights.
    expect(fitPlan(1600, 200, 960).readable).toBe(false);
    const two = splitDoc(
      doc,
      doc.sheets[0].blocks.map(() => 300),
    );
    expect(two.sheets).toHaveLength(2);
    expect(two.sheets[0].blocks.length + two.sheets[1].blocks.length).toBe(n);
    const html = docHtml(two, C.options);
    expect(html.match(/class="sheet"/g)).toHaveLength(2);
    expect(html.match(/Consuming raw or undercooked/g)).toHaveLength(2);
  });
});

describe('à la carte by meal and on two pages', () => {
  it('prints only the meals picked, a section each, named in the header', () => {
    const C = ctx('v1');
    const meals = alaCarteMeals(C);
    expect(meals).toContain('Lunch');
    const lunch = alaCarteDoc(C, { meals: ['Lunch'] });
    expect(lunch.sheets[0].title.startsWith('Lunch · À la carte · ')).toBe(true);
    const secs = new Set(lunch.sheets[0].blocks.flatMap((b) => (b.t === 'meal' ? [b.sec] : [])));
    expect([...secs]).toEqual(['Lunch']);
    // Served at lunch, so "lunch only" would say nothing.
    expect(menuHtml('alacarte', C, { meals: ['Lunch'] })).not.toContain('lunch only');
    const both = alaCarteDoc(C, { meals: ['Dinner', 'Lunch'] });
    expect(new Set(both.sheets[0].blocks.flatMap((b) => (b.t === 'meal' ? [b.sec] : [])))).toEqual(new Set(['Lunch', 'Dinner']));
    // The count follows the meals picked.
    const all = printedRecipes('alacarte', C);
    const lunchIds = printedRecipes('alacarte', C, { meals: ['Lunch'] });
    expect(lunchIds.size).toBeGreaterThan(0);
    expect(lunchIds.size).toBeLessThan(all.size);
    // A meal the à la carte menu does not serve is ignored.
    expect(alaCarteDoc(C, { meals: ['Snacks'] }).sheets[0].title).toMatch(/^À la carte/);
  });
  it('cuts long courses into pieces so two pages balance, naming a course carried over', () => {
    const C = ctx('v1');
    const doc = alaCarteDoc(C);
    const blocks = doc.sheets[0].blocks;
    for (const b of blocks) if (b.t === 'meal' && !b.cats[0].line) expect(b.cats[0].items.length).toBeLessThanOrEqual(COURSE_PIECE);
    const heights = blocks.map((b) => (b.t === 'meal' ? b.cats[0].items.length * 40 + 20 : 30));
    const two = splitDoc(doc, heights);
    expect(two.sheets).toHaveLength(2);
    const h = (s: DocSheet) => s.blocks.reduce((n, b) => n + heights[blocks.indexOf(b)], 0);
    const total = heights.reduce((a, b) => a + b, 0);
    expect(Math.max(h(two.sheets[0]), h(two.sheets[1]))).toBeLessThan(total * 0.62);
    const html = docHtml(two, C.options);
    expect(html).toMatch(/, continued<\/h2>/);
  });
});

describe('export to Word', () => {
  it('builds the pages, sizes and breaks of the printout', () => {
    const C = ctx('v1');
    const doc = alaCarteDoc(C);
    const two = splitDoc(
      doc,
      doc.sheets[0].blocks.map(() => 100),
    );
    const w = menuWordDoc(two, paperOf('half'), [
      { zoom: 0.8, space: 1, readable: false },
      { zoom: 1, space: 1, readable: true },
    ]);
    expect(w.page).toEqual({ w: 5.5 * 1440, h: 8.5 * 1440, margin: 504 });
    const paras = w.body.filter((x): x is WPara => x.k === 'p');
    // One page break, before the second page's header.
    expect(paras.filter((p) => p.pageBreak)).toHaveLength(1);
    const brand = paras.filter((p) => p.runs[0]?.text === 'Valencia Terrace');
    expect(brand.map((p) => p.size)).toEqual([0.8, 1].map((z) => Math.round(PT.brand * z * WORD_SCALE * 2) / 2));
    expect(w.body.some((x) => x.k === 'table')).toBe(true);
    const week = menuWordDoc({ ...dailyDoc(C, C.today), landscape: true }, paperOf('letter'), []);
    expect(week.landscape).toBe(true);
    expect(week.page.w).toBe(11 * 1440);
  });
  it('makes a .docx Word can open', async () => {
    const C = ctx('v1');
    const w = menuWordDoc(dailyDoc(C, C.today), paperOf('letter'), [{ zoom: 0.95, space: 0.8, readable: true }]);
    const buf = await docx.Packer.toBuffer(buildDocx(w, docx));
    const zip = await JSZip.loadAsync(buf);
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).toContain('<w:pgSz w:w="12240" w:h="15840"');
    expect(xml).toContain('Consuming raw or undercooked');
    expect(xml).toContain('Breakfast');
    expect(wordFileName('Sequoia Dining Room', 'daily menu', '2026-10-08')).toBe('Sequoia Dining Room daily menu 2026-10-08.docx');
  });
});
