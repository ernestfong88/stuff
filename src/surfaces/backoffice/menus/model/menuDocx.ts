/**
 * A printed menu as a Word document, so a chef can change the wording
 * before printing. Made from the same menu document as the printout: the
 * same pages, headings, dishes, descriptions and diet indicators, on the
 * same paper. Word does not fit pages the way the browser does, so each
 * page's fit (its zoom and spacing) is applied to the point sizes and the
 * space between paragraphs. This is the plain description of the file;
 * ui/wordExport turns it into a .docx.
 */
import { COMMUNITY_NAME } from '../../../../data';
import type { DocBlock, DocItem, DocSheet, MenuDoc } from './menuDoc';
import { FOOT_LINES } from './menuDoc';
import { andList, pageSize, type Paper, type TemplateId } from './menuPrint';
import type { Fit } from './printFit';

export interface WRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  /** Points. */
  size?: number;
  color?: string;
  caps?: boolean;
  /** A line break before this run. */
  br?: boolean;
}

export interface WPara {
  k: 'p';
  runs: WRun[];
  align: 'center' | 'left';
  /** Points: the paragraph's main size, used by runs without their own. */
  size: number;
  before: number;
  after: number;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  caps?: boolean;
  /** A rule under (heading) or over (footer) the paragraph. */
  rule?: 'below' | 'above';
  /** The rule's colour (hex); a light grey when unset. */
  ruleColor?: string;
  keepNext?: boolean;
  pageBreak?: boolean;
}

export interface WCell {
  paras: WPara[];
  /** Fill colour (hex, no #). */
  fill?: string;
  /** Share of the table's width, 0 to 1. */
  width?: number;
}

export interface WTable {
  k: 'table';
  rows: WCell[][];
  borders: boolean;
  /** The first row repeats as a header. */
  header?: boolean;
  pageBreak?: boolean;
}

export interface WordDoc {
  title: string;
  /** Twips (1/1440 inch). */
  page: { w: number; h: number; margin: number };
  landscape: boolean;
  font: string;
  accent: string;
  body: Array<WPara | WTable>;
}

const ACCENT: Record<TemplateId, string> = { classic: '145785', coastal: '3D7FAE', bistro: 'A8703B' };
const FONT: Record<TemplateId, string> = { classic: 'Georgia', coastal: 'Arial', bistro: 'Georgia' };
const GREY = '6B7780';
const INK = '3A4751';
const TW = 1440;

/** Point sizes at fit 1, from the printout's CSS (px × 0.75). */
export const PT = {
  kick: 7.5,
  brand: 21,
  title: 12.75,
  h2: 13.5,
  cat: 7.5,
  name: 10.9,
  desc: 9.4,
  any: 9.75,
  note: 8.6,
  foot: 7.9,
  diet: 7.1,
  cell: 9.75,
};

/**
 * Word sets type a little looser than the browser (its line height and
 * fallback fonts), so the browser's fit is taken down this much for Word.
 */
export const WORD_SCALE = 0.93;

/** Word's sizes come in half points. */
const half = (n: number) => Math.round(n * 2) / 2;

export function menuWordDoc(doc: MenuDoc, paper: Paper, fits: Fit[], template: TemplateId = 'classic'): WordDoc {
  const { w, h } = pageSize(paper, doc.landscape);
  const accent = ACCENT[template];
  const body: Array<WPara | WTable> = [];
  doc.sheets.forEach((s, i) => {
    const out = sheetWord(s, doc, fits[i] ?? { zoom: 1, space: 1, readable: true }, accent);
    if (i > 0) out[0].pageBreak = true;
    body.push(...out);
  });
  return {
    title: doc.title,
    page: { w: Math.round(w * TW), h: Math.round(h * TW), margin: Math.round(paper.margin * TW) },
    landscape: doc.landscape,
    font: FONT[template],
    accent,
    body,
  };
}

function sheetWord(s: DocSheet, doc: MenuDoc, fit: Fit, accent: string): Array<WPara | WTable> {
  const z = fit.zoom * WORD_SCALE;
  const pt = (n: number) => half(n * z);
  const gap = (px: number) => Math.round(px * 0.75 * z * fit.space * 10) / 10;
  const align = doc.centered ? 'center' : 'left';
  const para = (runs: WRun[], size: number, o: Partial<WPara> = {}): WPara => ({ k: 'p', runs, align, size: pt(size), before: 0, after: 0, ...o });
  const out: Array<WPara | WTable> = [
    para([{ text: s.kicker }], PT.kick, { align: 'center', bold: true, caps: true, color: GREY }),
    para([{ text: COMMUNITY_NAME }], PT.brand, { align: 'center', color: accent }),
    para([{ text: s.title }], PT.title, { align: 'center', after: gap(14), rule: 'below', ruleColor: accent }),
  ];
  const dishParas = (x: DocItem): WPara[] => [
    para(
      [
        { text: x.name, bold: true },
        ...x.tags.map((t) => ({ text: '  ' + t, italic: true, size: pt(PT.note), color: '5E6B74' })),
        ...x.diets.map((d) => ({ text: '  ' + d, size: pt(PT.diet), color: '4F6A38' })),
      ],
      PT.name,
      { keepNext: !!(x.desc || x.sides), after: x.desc || x.sides ? 0 : gap(7) },
    ),
    ...(x.desc ? [para([{ text: x.desc, italic: true }], PT.desc, { color: INK, keepNext: !!x.sides, after: x.sides ? 0 : gap(7) })] : []),
    ...(x.sides ? [para([{ text: 'Served with ' + andList(x.sides) }], PT.desc, { color: INK, after: gap(7) })] : []),
  ];
  const h2 = (t: string) => para([{ text: t }], PT.h2, { caps: true, color: accent, after: gap(6), rule: 'below', keepNext: true });
  const cat = (t: string) => para([{ text: t }], PT.cat, { bold: true, caps: true, color: GREY, before: gap(10), after: gap(3), keepNext: true });
  const blockParas = (b: DocBlock): Array<WPara | WTable> => {
    switch (b.t) {
      case 'meal':
        return [h2(b.title), ...b.cats.flatMap((c) => [cat(c.label), ...c.items.flatMap(dishParas)]), para([], 2, { after: gap(12) })];
      case 'list':
        return [
          h2(b.title),
          para([{ text: b.names.join(' · ') }], PT.any, { before: gap(4), after: gap(4) }),
          para([{ text: b.note }], PT.note, { color: GREY, after: gap(16) }),
        ];
      case 'note':
        return [para([{ text: b.text }], PT.note, { color: GREY, before: gap(3), after: gap(3) })];
      case 'snacks':
        return [
          para([{ text: 'Snacks · dietitian copy, not for residents' }], PT.cat, {
            bold: true,
            caps: true,
            color: 'A8703B',
            before: gap(10),
            keepNext: true,
          }),
          para([{ text: b.names.join(' · ') }], PT.any, { after: gap(6) }),
        ];
      case 'week': {
        const cellPara = (x: { k: 's' | 'e' | 'd'; name: string }) =>
          para([{ text: x.name }], PT.cell, {
            align: 'left',
            bold: x.k === 'e',
            italic: x.k !== 'e',
            color: x.k === 'd' ? '5E6B74' : x.k === 's' ? INK : undefined,
            after: gap(6),
          });
        const share = 1 / (b.heads.length + 0.8);
        return [
          {
            k: 'table',
            borders: true,
            header: true,
            rows: [
              [
                { paras: [para([], PT.cat)], fill: accent, width: share * 0.8 },
                ...b.heads.map(([d, md]) => ({
                  fill: accent,
                  width: share,
                  paras: [
                    para(
                      [
                        { text: d, bold: true, caps: true, color: 'FFFFFF' },
                        { text: md, color: 'FFFFFF', br: true },
                      ],
                      PT.cat,
                      { align: 'center' as const },
                    ),
                  ],
                })),
              ],
              ...b.rows.map((r) => [
                {
                  fill: 'F0F3F6',
                  width: share * 0.8,
                  paras: [para([{ text: r.meal }], PT.cat, { align: 'center', bold: true, caps: true, color: accent })],
                },
                ...r.cells.map((c) => ({ width: share, paras: c.length ? c.map(cellPara) : [para([], PT.cell)] })),
              ]),
            ],
          },
          para([{ text: b.note }], PT.note, { align: 'left', color: GREY, before: gap(8) }),
        ];
      }
      case 'orderTop':
        return [
          para([{ text: 'Name ______________________________   Apartment __________   Phone ______________' }], PT.any, {
            align: 'left',
            before: gap(10),
            after: gap(10),
          }),
          para([{ text: b.how }], 9, { align: 'left', color: INK, after: gap(10) }),
        ];
      case 'orderDay':
        return [
          para(
            [
              { text: b.date, bold: true },
              { text: '    Pick up range: ' + b.meals.map((m) => m.meal + ' ________').join('  '), size: pt(PT.note), color: INK },
            ],
            10.1,
            {
              align: 'left',
              color: accent,
              before: gap(6),
              after: gap(3),
              keepNext: true,
            },
          ),
          {
            k: 'table',
            borders: false,
            rows: [
              b.meals.map((m) => ({
                width: 1 / b.meals.length,
                paras: [
                  para([{ text: m.meal }], PT.cat, { align: 'left', bold: true, caps: true, color: GREY }),
                  ...m.items.map((x) =>
                    para([{ text: '☐ ___  ' + x.name }, ...x.diets.map((d) => ({ text: '  ' + d, size: pt(PT.diet), color: '4F6A38' }))], 9, {
                      align: 'left',
                      after: gap(3),
                    }),
                  ),
                ],
              })),
            ],
          },
        ];
    }
  };
  // À la carte: a section's courses in two columns, as printed.
  const blocks = s.blocks;
  let i = 0;
  const cycleMeals = s.pair ? blocks.flatMap((b, j) => (b.t === 'meal' && b.cycle ? [j] : [])) : [];
  while (i < blocks.length) {
    const b = blocks[i];
    if (cycleMeals.length === 2 && i === cycleMeals[0]) {
      out.push({
        k: 'table',
        borders: false,
        rows: [cycleMeals.map((j) => ({ width: 0.5, paras: blockParas(blocks[j]).filter((x): x is WPara => x.k === 'p') }))],
      });
      i++;
      continue;
    }
    if (cycleMeals.length === 2 && i === cycleMeals[1]) {
      i++;
      continue;
    }
    if (b.t === 'meal' && b.sec) {
      const sec = b.sec;
      const group: Array<WPara[]> = [];
      for (; i < blocks.length; i++) {
        const c = blocks[i];
        if (c.t !== 'meal' || c.sec !== sec) break;
        const head = group.length === 0;
        group.push(
          c.cats.flatMap((k) => [
            ...(k.cont && !head ? [] : [cat(k.label + (k.cont ? ', continued' : ''))]),
            ...(k.line ? [para([{ text: k.items.map((x) => x.name).join(' · ') }], PT.desc, { after: gap(6) })] : k.items.flatMap(dishParas)),
          ]),
        );
      }
      out.push(h2(sec + (b.first ? '' : ', continued')));
      // Courses down two columns, split where the halves are closest in length.
      const sizes = group.map((g) => g.length);
      const total = sizes.reduce((a, n) => a + n, 0);
      let k = 0;
      for (let acc = 0; k < group.length && acc + sizes[k] / 2 < total / 2; k++) acc += sizes[k];
      k = Math.max(1, Math.min(k, group.length - 1));
      const cols = group.length > 1 ? [group.slice(0, k).flat(), group.slice(k).flat()] : [group[0]];
      out.push({ k: 'table', borders: false, rows: [cols.map((paras) => ({ width: 1 / cols.length, paras }))] });
      out.push(para([], 2, { after: gap(12) }));
      continue;
    }
    out.push(...blockParas(b));
    i++;
  }
  out.push(
    para(
      FOOT_LINES.map((t, j) => ({ text: t, br: j > 0 })),
      PT.foot,
      { align: 'center', color: '5E6B74', before: gap(14), rule: 'above' },
    ),
  );
  return out;
}

/** "Sequoia daily menu 2026-10-08.docx" */
export function wordFileName(venue: string, what: string, isoDate: string): string {
  return `${venue} ${what} ${isoDate}.docx`.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ');
}
