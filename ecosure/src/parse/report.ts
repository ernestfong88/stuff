/**
 * EcoSure food safety report PDF -> Report record.
 * Port of the original parse.py: findings are found by text position.
 *  - each cited question has its criticality word (Critical/Major/Minor) at x 470 to 520
 *  - the question text sits left of x 400 in the same row band, points right of x 530
 *  - Response:, Comment: and Findings: labels switch what the following lines are
 *  - photos under a finding belong to it
 *  - parsing stops at "Detailed standards"; the detailed section gives manager and health inspection answers
 */
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { POINTS, SECTION_NAMES, critFor, findStandard, sectionFor, shortLabel } from '../catalog';
import type { Crit, Item, Report } from '../types';
import { isoDate, splitUnit } from '../util';
import type { Parsed } from './cap';
import { extractPhoto, readAll, type Line, type PageData } from './pdf';

const CRIT = new Set(['Critical', 'Major', 'Minor']);
const SEC_KEYS = Object.keys(SECTION_NAMES).sort((a, b) => b.length - a.length);

export function isReport(pages: PageData[]): boolean {
  const t = pages[0]?.lines.map((l) => l.t) ?? [];
  return t.includes('Location ID') || t.includes('Property Name') || (t.some((x) => /Food Safety/i.test(x)) && pages.some((p) => p.lines.some((l) => CRIT.has(l.t) && l.x > 470 && l.x < 520)));
}

const clean = (s: string) => s.replace(/\s*\*The actual visit time details may differ in the final report\.?/g, '').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
const mid = (l: Line) => (l.y + l.y1) / 2;

function isHeader(t: string): boolean {
  return t === 'Actionable standards' || SEC_KEYS.some((k) => t === k || t.startsWith(k + ' /') || t.startsWith(k + '/'));
}

interface Raw { section: string; subsection: string; question: string; crit: string; points: number; response: string; comment: string; f: [number, number, string][]; photos: string[] }

export async function parseReport(doc: PDFDocumentProxy, file: string, pagesIn?: PageData[]): Promise<Parsed<Report>> {
  const pages = pagesIn ?? (await readAll(doc));
  const L0 = pages[0].lines;
  const after = (label: string): string => {
    const o = L0.find((l) => l.t === label);
    if (!o) return '';
    const c = L0.filter((p) => Math.abs(p.y - o.y) < 3 && p.x > o.x + 20 && p.x < o.x + 220 && p.t !== label).sort((a, b) => a.x - b.x);
    return c[0]?.t ?? '';
  };
  const property = after('Property Name');
  const city = after('City');
  const start = after('Start Date Time');
  const big = L0.filter((o) => o.size > 30).sort((a, b) => b.size - a.size)[0];
  const scoreTxt = big?.t.replace(/[^\d.]/g, '') ?? '';
  const score = scoreTxt ? parseFloat(scoreTxt) : null;

  const items: Raw[] = [];
  const photos = new Map<string, Blob>();
  let cur: Raw | null = null, section = '', lastHeader: Line | null = null, mode: string | null = null, done = false, pcount = 0;
  for (const pd of pages) {
    if (done) break;
    const L = pd.lines;
    type Ev = { k: 'L' | 'Q' | 'P'; y: number; o: unknown };
    const ev: Ev[] = L.map((o) => ({ k: 'L' as const, y: o.y, o }));
    for (const c of L.filter((o) => CRIT.has(o.t) && o.x > 470 && o.x < 520)) {
      const band = L.filter((p) => Math.abs(mid(p) - mid(c)) <= 13 && !p.bold && p.size > 7 && !isHeader(p.t));
      ev.push({ k: 'Q', y: Math.min(...band.map((p) => p.y)) - 0.5, o: c });
    }
    const seen = new Set<string>();
    for (const im of pd.images) {
      if ((im.pw && im.pw < 120) || im.x1 - im.x0 <= 40 || im.y1 - im.y0 <= 30) continue;
      const k = [im.x0, im.y0, im.x1, im.y1].map(Math.round).join(',');
      if (seen.has(k)) continue;
      seen.add(k);
      ev.push({ k: 'P', y: im.y0, o: im });
    }
    ev.sort((a, b) => a.y - b.y || (a.k === 'Q' ? 0 : 1) - (b.k === 'Q' ? 0 : 1));
    const used = new Set<Line>();
    for (const e of ev) {
      if (e.k === 'L') {
        const o = e.o as Line, t = o.t;
        if (t === 'Detailed standards') { done = true; break; }
        if (used.has(o) || o.y > 790) continue;
        // Section header bars (a long subsection title wraps onto a second line right below).
        if (isHeader(t) || (lastHeader && o.y - lastHeader.y > 0 && o.y - lastHeader.y < 14 && Math.abs(o.x - lastHeader.x) < 6)) {
          if (t === 'Actionable standards') { lastHeader = null; continue; }
          section = isHeader(t) ? t : section + ' ' + t;
          lastHeader = o; mode = null; continue;
        }
        if (o.size < 7 || !cur) continue;
        if (t === 'Response:') { mode = 'resp'; continue; }
        if (t === 'Comment:') { mode = 'comm'; continue; }
        if (t === 'Findings:') { mode = 'find'; continue; }
        if (mode === 'resp') cur.response += t;
        else if (mode === 'comm') cur.comment += (cur.comment ? ' ' : '') + t;
        else if (mode === 'find') cur.f.push([pd.n, o.y, t]);
      } else if (e.k === 'Q') {
        const c = e.o as Line;
        const band = L.filter((p) => Math.abs(mid(p) - mid(c)) <= 13 && p !== c).sort((a, b) => a.y - b.y);
        const q = band.filter((p) => p.x < 400 && !p.bold && !isHeader(p.t)).map((p) => p.t).join(' ');
        const pts = band.filter((p) => p.x > 530).map((p) => p.t);
        band.forEach((p) => used.add(p));
        lastHeader = null;
        const m = section.match(/^(.*?[A-Z)]) ?\/ ?(?=[A-Z][a-z])(.*)$/);
        cur = { section: (m ? m[1] : section).trim(), subsection: (m ? m[2] : '').trim(), question: q.trim(), crit: c.t, points: pts.length ? parseFloat(pts[0]) || 0 : 0, response: '', comment: '', f: [], photos: [] };
        items.push(cur); mode = null;
      } else if (cur) {
        const im = e.o as PageData['images'][number];
        try {
          const key = `new:${file}:${pd.n + 1}:${++pcount}`;
          photos.set(key, await extractPhoto(pd, im));
          cur.photos.push(key);
        } catch { /* unreadable image */ }
      }
    }
  }

  // Group finding lines into bullets.
  const out: Item[] = items.map((it) => {
    const groups: { at: [number, number]; t: string[] }[] = [];
    const claimed = new Set<number>();
    for (const [p, y, t] of it.f) {
      if (t.startsWith('•') && t !== '•') groups.push({ at: [p, y], t: [t.replace(/^•\s*/, '').trim()] });
      else if (t === '•') groups.push({ at: [p, y], t: [] });
    }
    for (const g of groups) {
      if (g.t.length) continue;
      it.f.forEach(([p, y, t], j) => { if (p === g.at[0] && !t.startsWith('•') && Math.abs(y - g.at[1]) <= 12) { g.t.push(t); claimed.add(j); } });
    }
    const before = (a: [number, number], b: [number, number]) => a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1]);
    it.f.forEach(([p, y, t], j) => {
      if (t.startsWith('•') || claimed.has(j)) return;
      const prev = groups.filter((g) => before(g.at, [p, y]));
      if (prev.length) prev[prev.length - 1].t.push(t);
      else if (groups.length) groups[0].t.unshift(t);
      else groups.push({ at: [p, y], t: [t] });
    });
    groups.sort((a, b) => a.at[0] - b.at[0] || a.at[1] - b.at[1]);
    const comment = clean(it.comment);
    const findings = groups.map((g) => {
      let f = clean(g.t.join(' '));
      const c = comment.slice(0, 40);
      if (c && f.includes(c)) f = f.slice(0, f.indexOf(c)).trim();
      return f;
    }).filter(Boolean);
    const std = findStandard(it.question);
    const crit = (CRIT.has(it.crit) ? it.crit : critFor(it.question, '')) as Crit;
    const secRaw = it.section.toUpperCase();
    return {
      cid: std?.cid ?? '',
      section: std?.section || SECTION_NAMES[secRaw] || sectionFor(it.question, '', it.section),
      subsection: std?.sub || it.subsection,
      question: it.question,
      short: shortLabel(it.question),
      criticality: crit,
      points: it.points || POINTS[crit],
      comment,
      findings,
      photos: it.photos,
    };
  });

  // Detailed section answers.
  const full = pages.flatMap((p) => p.lines.map((l) => l.t));
  const ans = (label: string): string => {
    const i = full.indexOf(label);
    if (i < 0) return '';
    for (let j = i + 1; j < Math.min(i + 4, full.length); j++) if (full[j] === 'Answer:') return full[j + 1] ?? '';
    return '';
  };
  const positive: string[] = [];
  const pi = full.indexOf('Positive Feedback');
  if (pi >= 0) {
    const k = full.indexOf('Findings:', pi);
    if (k >= 0) for (const t of full.slice(k + 1, k + 15)) {
      if (t.startsWith('•')) positive.push(t.replace(/^•\s*/, ''));
      else if (positive.length && t !== t.toUpperCase() && !t.startsWith('DEMONSTRATION') && !t.includes(' / ')) positive[positive.length - 1] += ' ' + t;
      else break;
    }
  }

  const { community, kitchen } = splitUnit(property);
  const date = isoDate(start);
  const warnings: string[] = [];
  if (!property) warnings.push('Could not read the property name.');
  if (!date) warnings.push('Could not read the audit date.');
  if (score == null) warnings.push('Could not read the score.');
  if (!out.length && score != null && score < 100) warnings.push('No findings were read, but the score is below 100. EcoSure may have changed the report layout.');
  const lost = out.reduce((a, i) => a + i.points, 0);
  if (score != null && out.length && Math.abs(100 - score - lost) > 0.01) warnings.push(`Points lost add up to ${lost}, but the score of ${score} means ${100 - score}. A finding may have been missed or misread.`);
  const unknown = out.filter((i) => !findStandard(i.question)).length;
  if (unknown) warnings.push(`${unknown} finding(s) use a question the site has not seen before. They are listed under their own text.`);

  return {
    rec: {
      kind: 'report', id: '', community, kitchen: kitchen ?? 'Main Kitchen', city, date, score,
      manager: (ans('Manager First Name') + ' ' + ans('Manager Last Name')).trim(),
      hdDate: isoDate(ans('Date of last Health Department Inspection')) || ans('Date of last Health Department Inspection'),
      hdResult: ans('Result of last Health Department Inspection'),
      positive: positive.map(clean), items: out, file, source: 'pdf', warnings, importedAt: new Date().toISOString(),
    },
    photos,
  };
}
