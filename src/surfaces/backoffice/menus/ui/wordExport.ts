/**
 * Export to Word: turn a menu's Word description (model/menuDocx) into a
 * .docx and download it. The docx library loads only when someone exports.
 */
import type { WordDoc, WPara, WTable } from '../model/menuDocx';

type Docx = typeof import('docx');

/** Build the .docx document with the given docx module (passed in so tests can build it without a browser). */
export function buildDocx(w: WordDoc, d: Docx) {
  const contentW = (w.landscape ? Math.max(w.page.w, w.page.h) : Math.min(w.page.w, w.page.h)) - 2 * w.page.margin;
  const rule = { style: d.BorderStyle.SINGLE, size: 6, color: 'C9D2DA', space: 4 };
  const para = (p: WPara) =>
    new d.Paragraph({
      alignment: p.align === 'center' ? d.AlignmentType.CENTER : d.AlignmentType.LEFT,
      // Spacing is in twentieths of a point.
      spacing: { before: Math.round(p.before * 20), after: Math.round(p.after * 20), line: 240, lineRule: d.LineRuleType.AUTO },
      keepNext: p.keepNext,
      pageBreakBefore: p.pageBreak,
      border: p.rule === 'below' ? { bottom: { ...rule, color: p.ruleColor ?? rule.color } } : p.rule === 'above' ? { top: rule } : undefined,
      children: p.runs.map(
        (r) =>
          new d.TextRun({
            text: r.text,
            break: r.br ? 1 : undefined,
            bold: r.bold ?? p.bold,
            italics: r.italic ?? p.italic,
            allCaps: r.caps ?? p.caps,
            color: r.color ?? p.color,
            // Sizes are in half points.
            size: Math.round((r.size ?? p.size) * 2),
          }),
      ),
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
                  margins: { top: 60, bottom: 60, left: 100, right: 100 },
                  children: c.paras.length ? c.paras.map(para) : [new d.Paragraph('')],
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

/** Build the .docx and hand it to the browser as a download. */
export async function downloadWord(w: WordDoc, fileName: string): Promise<void> {
  const d = await import('docx');
  const blob = await d.Packer.toBlob(buildDocx(w, d));
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
