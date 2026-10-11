/**
 * EcoSure Corrective Action Plan PDF -> Cap record(s).
 * Columns are read by x position: <80 client id, <255 item, <428 action plan, <510 owner, >=510 due date.
 */
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { Cap, CapItem } from '../types';
import { isoDate, splitUnit } from '../util';
import { extractPhoto, readAll, type PageData } from './pdf';

export interface Parsed<T> {
  rec: T;
  photos: Map<string, Blob>; // temporary photo keys used in rec -> JPEG
}

interface RawItem { cid: string; item: string; plan: string[]; owner: string; due: string; touch: string; comment: string[]; subs: string[]; notes: string[]; photos: string[]; at: [number, number] }
interface RawCap { unit: string; unitName: string[]; status: string; submitted: string; approved: string; completed: string; announce: string; auditType: string; items: RawItem[] }

const HEAD = new Set(['Item', 'Action Plan', 'Project owner', 'Due date']);

export function isCap(pages: PageData[]): boolean {
  return pages.length > 0 && pages[0].lines.some((l) => l.t === 'Corrective Action Plan');
}

export async function parseCap(doc: PDFDocumentProxy, file: string, pagesIn?: PageData[]): Promise<Parsed<Cap>[]> {
  const pages = pagesIn ?? (await readAll(doc));
  const caps: RawCap[] = [];
  let cur: RawCap | null = null;
  let item: RawItem | null = null;
  let mode: string | null = null;
  let expectUnit = false;
  for (const pd of pages) {
    const L = [...pd.lines].sort((a, b) => a.y - b.y || a.x - b.x);
    const valueAt = (y: number, x0: number, x1: number) => L.filter((o) => Math.abs(o.y - y) < 3 && o.x > x0 && o.x < x1).map((o) => o.t);
    for (const o of L) {
      const { x, y, t, size } = o;
      if (t === 'Client Confidentiality Header' || t === 'Food Safety') continue;
      if (t === 'Corrective Action Plan') {
        cur = { unit: '', unitName: [], status: '', submitted: '', approved: '', completed: '', announce: '', auditType: '', items: [] };
        caps.push(cur); item = null; mode = 'hdr'; expectUnit = false; continue;
      }
      if (!cur) continue;
      if (mode === 'hdr') {
        if (t.startsWith('Status:') && !cur.status && x > 150 && x < 350) { cur.status = t.split(':').slice(1).join(':').trim(); expectUnit = true; continue; }
        if (expectUnit && x > 150 && x < 350 && size > 8.5) { cur.unit = t; expectUnit = false; continue; }
        const fields: [string, keyof RawCap, number, number][] = [
          ['Approved date:', 'approved', 470, 600], ['Submitted date:', 'submitted', 470, 600], ['Completed date:', 'completed', 470, 600],
          ['Announce Date:', 'announce', 270, 400], ['Audit Type:', 'auditType', 270, 400],
        ];
        const f = fields.find(([lab]) => t === lab);
        if (f) { const v = valueAt(y, f[2], f[3]); if (v.length) (cur[f[1]] as string) = v[0]; continue; }
        if (t === 'Unit Number:' || t === 'Unit Name:' || t === 'Status:' || t === 'Form Name:' || t === 'Primary Contact:') continue;
      }
      if (t === 'Client ID') {
        item = { cid: '', item: '', plan: [], owner: '', due: '', touch: '', comment: [], subs: [], notes: [], photos: [], at: [pd.n, y] };
        cur.items.push(item); mode = 'row'; continue;
      }
      if (!item) continue;
      if ((mode === 'row' || mode === 'notes') && HEAD.has(t)) continue;
      if (t === 'Touchpoint:') { mode = 'touch'; continue; }
      if (t === 'Primary comment:') { mode = 'comm'; continue; }
      if (t === 'Sub Answers:') { mode = 'subs'; continue; }
      if (t.startsWith('Submitter notes')) { mode = 'notes'; continue; }
      if (t === '-') { mode = null; continue; }
      if (mode === 'row') {
        if (x < 80) {
          const m = t.match(/^(\d+(?:\.\d+)+)(.*)$/);
          if (m && !item.cid) { item.cid = m[1]; if (m[2].trim()) item.plan.push(m[2].trim()); }
          else item.plan.push(t);
        } else if (x < 255) item.item += (item.item ? ' ' : '') + t;
        else if (x < 428) item.plan.push(t);
        else if (x < 510) item.owner += (item.owner ? ' ' : '') + t;
        else if (/^\d{2}\/\d{2}\/\d{4}$/.test(t)) item.due = t;
        else item.plan.push(t);
      } else if (mode === 'touch') item.touch += (item.touch ? ' ' : '') + t;
      else if (mode === 'comm') item.comment.push(t);
      else if (mode === 'subs') {
        if (t.startsWith('•')) item.subs.push(t.replace(/^•\s*/, '').trim());
        else if (item.subs.length) item.subs[item.subs.length - 1] += ' ' + t;
        else item.subs.push(t);
      } else if (mode === 'notes') item.notes.push(t);
    }
  }

  // Photos belong to the item whose Client ID row sits above them.
  const photos = new Map<string, Blob>();
  const allItems = caps.flatMap((c) => c.items);
  let n = 0;
  for (const pd of pages) {
    for (const im of pd.images) {
      if (im.x1 - im.x0 < 20 || im.y1 - im.y0 < 20) continue;
      const owner = allItems.filter((it) => it.at[0] < pd.n || (it.at[0] === pd.n && it.at[1] < im.y0)).pop();
      if (!owner) continue;
      try {
        const key = `new:${file}:${pd.n + 1}:${++n}`;
        photos.set(key, await extractPhoto(pd, im));
        owner.photos.push(key);
      } catch { /* skip unreadable image */ }
    }
  }

  const now = new Date().toISOString();
  return caps.filter((c) => c.unit || c.items.length).map((c) => {
    const items: CapItem[] = c.items.map((it) => {
      const rawPlan = it.plan.join(' ').trim();
      let plan = rawPlan.replace(/^(Other|Training|Retrain\w*|Repair\w*|Replace\w*|Clean\w*)\s*-\s*/, '');
      plan = plan.replace(/\s*ˇ\s*/g, '; ').replace(/^[;\s]+|[;\s]+$/g, '').replace(/ï/g, '').replace(/\s+/g, ' ').trim();
      if (/^other\s*-?$/i.test(plan)) plan = '';
      // Dates EcoSure prints inside the plan column, and the category prefix on some plans.
      plan = plan.replace(/\s*\d{2}\/\d{2}\/\d{4}\s*/g, ' ').replace(/^Health Department Good Hygienic\s*Practices-\s*/, '').trim();
      plan = plan.replace(/\s+([.,;])/g, '$1').replace(/\b(were|was|will|be|and|the|for|to|of|are|a|an|in|with|is|been|or|on|from)\s*;\s+/g, '$1 ').replace(/\s+/g, ' ').trim();
      let update = it.notes.join(' ').replace(/User,\s*EcoSure\s*\((\d\d\/\d\d\/\d{4})\):\s*/g, '').trim();
      const n = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (update && plan && (n(update).slice(0, 60) === n(plan).slice(0, 60) || n(plan).includes(n(update)))) update = '';
      if (!plan && update) { plan = update; update = ''; }
      return {
        cid: it.cid, question: it.item.trim(), action: plan, update, owner: it.owner.trim(), due: isoDate(it.due),
        touch: it.touch, comment: it.comment.join(' ').replace(/^-$/, '').trim(), subs: it.subs, photos: it.photos,
      };
    });
    const owners = items.map((i) => i.owner).filter(Boolean);
    const dues = items.map((i) => i.due).filter(Boolean);
    const mode = (xs: string[]) => xs.sort((a, b) => xs.filter((v) => v === b).length - xs.filter((v) => v === a).length)[0] ?? '';
    for (const i of items) { if (!i.owner) i.owner = mode([...owners]); if (!i.due) i.due = mode([...dues]); }
    const { community, kitchen } = splitUnit(c.unit);
    const warnings: string[] = [];
    if (!c.unit) warnings.push('Could not read the community name.');
    if (!c.status) warnings.push('Could not read the CAP status.');
    if (!items.length) warnings.push('No CAP items found. EcoSure may have changed the layout.');
    const noCid = items.filter((i) => !i.cid).length;
    if (noCid) warnings.push(`${noCid} item(s) have no client id.`);
    const auditDate = isoDate(c.announce);
    const rec: Cap = {
      kind: 'cap', id: '', community, kitchen: kitchen ?? 'Main Kitchen', auditDate,
      status: c.status || 'Unknown', submitted: isoDate(c.submitted), approved: isoDate(c.approved), completed: isoDate(c.completed),
      items, file, source: 'pdf', warnings, importedAt: now,
    };
    return { rec, photos };
  });
}
