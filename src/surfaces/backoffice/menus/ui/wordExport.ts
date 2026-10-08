/**
 * Export to Word: turn a menu's Word description (model/menuDocx) into a
 * .docx and download it. The docx library loads only when someone exports.
 * Diet icons go in as the printout's drawings (SVG, with a PNG for Word
 * versions that can't show SVG); a diet without a drawing keeps its letters.
 */
import { dietSvg } from '../model/dietIcons';
import type { WordDoc, WPara, WRun, WTable } from '../model/menuDocx';

type Docx = typeof import('docx');

/** Each diet icon in the file, by diet: its drawing as SVG and as PNG. */
export type DocxIcons = Record<string, { svg: Uint8Array; png: Uint8Array }>;

/** Table cells' left and right margins, twips. */
const CELL_PAD = 100;

/** Build the .docx document with the given docx module (passed in so tests can build it without a browser). */
export function buildDocx(w: WordDoc, d: Docx, icons: DocxIcons = {}) {
  const contentW = (w.landscape ? Math.max(w.page.w, w.page.h) : Math.min(w.page.w, w.page.h)) - 2 * w.page.margin;
  const rule = { style: d.BorderStyle.SINGLE, size: 6, color: 'C9D2DA', space: 4 };
  const run = (r: WRun, p: WPara) => {
    const size = r.size ?? p.size;
    const img = r.icon ? icons[r.icon] : undefined;
    if (img) {
      // A touch larger than the text, as printed; pixels at 96 per inch.
      const px = Math.round(size * (4 / 3) * 1.05);
      return new d.ImageRun({
        type: 'svg',
        data: img.svg,
        fallback: { type: 'png', data: img.png },
        transformation: { width: px, height: px },
        altText: { name: r.icon!, title: r.icon!, description: r.icon! },
      });
    }
    return new d.TextRun({
      ...(r.tab ? { children: [new d.Tab(), r.text] } : { text: r.text }),
      break: r.br ? 1 : undefined,
      bold: r.bold ?? p.bold,
      italics: r.italic ?? p.italic,
      allCaps: r.caps ?? p.caps,
      color: r.color ?? p.color,
      // Sizes are in half points.
      size: Math.round(size * 2),
    });
  };
  /** A paragraph in a column `width` twips wide (its right tab sits at that edge). */
  const para = (p: WPara, width = contentW) =>
    new d.Paragraph({
      alignment: p.align === 'center' ? d.AlignmentType.CENTER : d.AlignmentType.LEFT,
      // Spacing is in twentieths of a point.
      spacing: { before: Math.round(p.before * 20), after: Math.round(p.after * 20), line: 240, lineRule: d.LineRuleType.AUTO },
      keepNext: p.keepNext,
      pageBreakBefore: p.pageBreak,
      border: p.rule === 'below' ? { bottom: { ...rule, color: p.ruleColor ?? rule.color } } : p.rule === 'above' ? { top: rule } : undefined,
      tabStops: p.tabRight ? [{ type: d.TabStopType.RIGHT, position: width, leader: d.LeaderType.DOT }] : undefined,
      children: p.runs.map((r) => run(r, p)),
    });
  const none = { style: d.BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const line = { style: d.BorderStyle.SINGLE, size: 4, color: 'C9D2DA' };
  const table = (t: WTable) => {
    const widths = t.rows[0].map((c) => Math.round((c.width ?? 1 / t.rows[0].length) * contentW));
    const b = t.borders ? line : none;
    return new d.Table({
      width: { size: contentW, type: d.WidthType.DXA },
      columnWidths: widths,
      borders: { top: b, bottom: b, left: b, right: b, insideHorizontal: b, insideVertical: b },
      rows: t.rows.map(
        (r, i) =>
          new d.TableRow({
            tableHeader: t.header && i === 0,
            cantSplit: true,
            children: r.map(
              (c, j) =>
                new d.TableCell({
                  width: { size: widths[j], type: d.WidthType.DXA },
                  shading: c.fill ? { fill: c.fill, type: d.ShadingType.CLEAR, color: 'auto' } : undefined,
                  margins: { top: 60, bottom: 60, left: CELL_PAD, right: CELL_PAD },
                  children: c.paras.length ? c.paras.map((p) => para(p, widths[j] - 2 * CELL_PAD)) : [new d.Paragraph('')],
                }),
            ),
          }),
      ),
    });
  };
  const children = w.body.flatMap((x) => {
    if (x.k === 'p') return [para(x)];
    // A table can't break the page itself, so an empty paragraph before it does.
    return x.pageBreak ? [new d.Paragraph({ pageBreakBefore: true }), table(x)] : [table(x)];
  });
  return new d.Document({
    title: w.title,
    creator: 'KiscoConnect',
    styles: { default: { document: { run: { font: w.font, size: 20 } } } },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: Math.min(w.page.w, w.page.h),
              height: Math.max(w.page.w, w.page.h),
              orientation: w.landscape ? d.PageOrientation.LANDSCAPE : d.PageOrientation.PORTRAIT,
            },
            margin: { top: w.page.margin, right: w.page.margin, bottom: w.page.margin, left: w.page.margin },
          },
        },
        children,
      },
    ],
  });
}

/** The diets a Word file shows as icons. */
export function wordIconDiets(w: WordDoc): string[] {
  const runs = w.body.flatMap((x) => (x.k === 'p' ? [x] : x.rows.flat().flatMap((c) => c.paras))).flatMap((p) => p.runs);
  return [...new Set(runs.flatMap((r) => (r.icon ? [r.icon] : [])))];
}

/** An icon's drawing as a PNG, drawn by the browser (4× its printed size, so it stays sharp). */
function iconPng(svg: string, px = 64): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const img = new Image(px, px);
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = px;
      c.getContext('2d')!.drawImage(img, 0, 0, px, px);
      c.toBlob((b) => (b ? b.arrayBuffer().then((a) => resolve(new Uint8Array(a)), reject) : reject(new Error('no png'))), 'image/png');
    };
    img.onerror = () => reject(new Error('icon did not draw'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

/** The icons a Word file needs; one that will not draw is left out, so it keeps its letters. */
async function wordIcons(w: WordDoc): Promise<DocxIcons> {
  const out: DocxIcons = {};
  await Promise.all(
    wordIconDiets(w).map(async (f) => {
      const svg = dietSvg(f, { color: '#3A4751', px: 64 });
      try {
        out[f] = { svg: new TextEncoder().encode(svg), png: await iconPng(svg) };
      } catch {
        // Letters instead.
      }
    }),
  );
  return out;
}

/** Build the .docx and hand it to the browser as a download. */
export async function downloadWord(w: WordDoc, fileName: string): Promise<void> {
  const d = await import('docx');
  const blob = await d.Packer.toBlob(buildDocx(w, d, await wordIcons(w)));
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
