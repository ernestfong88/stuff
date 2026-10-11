/** Reads dropped files (EcoSure PDFs, the previous review page, backups) into records ready to save. */
import { learnStandard } from './catalog';
import { canonical } from './model';
import { isCap, parseCap } from './parse/cap';
import { fromLegacy, isLegacyJson, readLegacyHtml } from './parse/legacy';
import { openPdf, readAll } from './parse/pdf';
import { isReport, parseReport } from './parse/report';
import { recId, type Backend } from './store';
import type { FileRec, Rec, Settings } from './types';

export type QKind = 'report' | 'cap' | 'legacy' | 'backup' | 'unknown';

export interface QItem {
  id: string;
  name: string;
  status: 'reading' | 'ready' | 'saving' | 'saved' | 'error' | 'skipped';
  kind: QKind;
  recs: FileRec[];
  photos: Map<string, Blob>; // temporary key -> JPEG
  dataPhotos: Record<string, string>; // backup/legacy photo name -> data URL
  pdf?: Blob;
  error?: string;
  progress?: string;
  settings?: Settings; // from a backup
  selfAudits?: Rec[]; // from a backup
}

export interface BackupFile {
  format: 'ecosure-review-backup';
  version: 1;
  exportedAt: string;
  settings: Settings | null;
  records: Rec[];
  photos: Record<string, string>; // ref -> data URL
}

let seq = 0;

export async function readFile(file: File, settings: Settings): Promise<QItem> {
  const q: QItem = { id: 'q' + ++seq, name: file.name, status: 'reading', kind: 'unknown', recs: [], photos: new Map(), dataPhotos: {} };
  try {
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.pdf') || file.type === 'application/pdf') {
      const buf = await file.arrayBuffer();
      const doc = await openPdf(buf);
      const pages = await readAll(doc);
      if (isCap(pages)) {
        const caps = await parseCap(doc, file.name, pages);
        q.kind = 'cap';
        q.recs = caps.map((c) => c.rec);
        q.photos = caps[0]?.photos ?? new Map();
      } else if (isReport(pages)) {
        const r = await parseReport(doc, file.name, pages);
        q.kind = 'report';
        q.recs = [r.rec];
        q.photos = r.photos;
      } else {
        throw new Error('This PDF does not look like an EcoSure food safety report or a Corrective Action Plan.');
      }
      q.pdf = new Blob([buf], { type: 'application/pdf' });
      await doc.destroy();
    } else if (lower.endsWith('.html') || lower.endsWith('.htm')) {
      const b = readLegacyHtml(await file.text());
      if (!b) throw new Error('This page does not contain EcoSure audit data.');
      q.kind = 'legacy';
      const { reports, caps } = fromLegacy(b, (n) => (b.photos[n] ? 'tmp:' + n : null));
      q.recs = [...reports, ...caps];
      q.dataPhotos = Object.fromEntries(Object.entries(b.photos).map(([k, v]) => ['tmp:' + k, v]));
    } else if (lower.endsWith('.json')) {
      const v = JSON.parse(await file.text());
      if (v?.format === 'ecosure-review-backup') {
        const bk = v as BackupFile;
        q.kind = 'backup';
        q.recs = bk.records.filter((r): r is FileRec => r.kind !== 'self');
        q.selfAudits = bk.records.filter((r) => r.kind === 'self');
        q.dataPhotos = bk.photos ?? {};
        q.settings = bk.settings ?? undefined;
      } else if (isLegacyJson(v)) {
        q.kind = 'legacy';
        const { reports, caps } = fromLegacy({ audits: v, photos: {} }, () => null);
        q.recs = [...reports, ...caps];
      } else throw new Error('This JSON file is not a backup from this site or a data.json from the old pipeline.');
    } else {
      throw new Error('Drop PDF files from EcoSure (reports or CAPs), a backup .json, or the old review page .html.');
    }
    for (const r of q.recs) {
      r.community = canonical(r.community, settings.roster);
      r.id = r.id && q.kind === 'backup' ? r.id : recId(r);
    }
    q.status = 'ready';
  } catch (e) {
    q.status = 'error';
    q.error = e instanceof Error ? e.message : String(e);
  }
  return q;
}

async function dataUrlToBlob(u: string): Promise<Blob> {
  return (await fetch(u)).blob();
}

/** Upload photos and the original PDF, swap temporary refs for stored ones, and save. */
export async function saveItem(q: QItem, be: Backend, onProgress: (s: string) => void): Promise<void> {
  const map = new Map<string, string>();
  const refs = new Set(q.recs.flatMap((r) => (r.kind === 'report' ? r.items.flatMap((i) => i.photos) : r.items.flatMap((i) => i.photos))));
  let done = 0;
  for (const ref of refs) {
    let blob: Blob | undefined = q.photos.get(ref);
    if (!blob && q.dataPhotos[ref]) blob = await dataUrlToBlob(q.dataPhotos[ref]);
    if (blob) {
      onProgress(`Saving photos ${++done} of ${refs.size}`);
      map.set(ref, await be.savePhoto(blob));
    }
  }
  const fix = (xs: string[]) => xs.map((x) => map.get(x) ?? x).filter((x) => !x.startsWith('new:') && !x.startsWith('tmp:'));
  let fileRef: string | null = null;
  if (q.pdf && be.keepsFiles) { onProgress('Saving the original PDF'); fileRef = await be.saveFile(q.pdf); }
  let n = 0;
  for (const r of q.recs) {
    onProgress(`Saving record ${++n} of ${q.recs.length}`);
    if (r.kind === 'report') r.items.forEach((i) => (i.photos = fix(i.photos)));
    else r.items.forEach((i) => (i.photos = fix(i.photos)));
    if (fileRef) r.fileRef = fileRef;
    if (r.kind === 'report') r.items.forEach(learnStandard);
    await be.put(r);
  }
  for (const r of q.selfAudits ?? []) await be.put(r);
}
