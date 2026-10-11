/**
 * The previous review page (EcoSure_Audit_Review.html) and its data.json carry
 * audits with CAPs merged in. Split them back into Report and Cap records.
 */
import { POINTS } from '../catalog';
import type { Cap, Crit, Report } from '../types';
import { isoDate } from '../util';

interface LegacyAudit {
  community: string; kitchen: string; city: string; date: string; score: number | null; manager: string;
  hd_date: string; hd_result: string; positive: string[]; source?: string | null; file?: string;
  cap: null | { status: string; submitted: string; approved: string; file: string };
  items: { section: string; subsection: string; question: string; short: string; criticality: string; points: number; comment: string; findings: string[]; photos: string[];
    cap?: null | { action: string; update: string; owner: string; due: string; cid: string } }[];
}

export interface LegacyBundle { audits: LegacyAudit[]; photos: Record<string, string> }

/** Pull AUDITS and PHOTOS out of the old single-file page. */
export function readLegacyHtml(html: string): LegacyBundle | null {
  const a = html.match(/const AUDITS=(\[.*?\]);\s*\n/s);
  if (!a) return null;
  const p = html.match(/const PHOTOS=(\{.*?\});\s*\n/s);
  return { audits: JSON.parse(a[1]), photos: p ? JSON.parse(p[1]) : {} };
}

export function isLegacyJson(v: unknown): v is LegacyAudit[] {
  return Array.isArray(v) && v.length > 0 && typeof v[0] === 'object' && v[0] && 'community' in v[0] && 'items' in v[0] && 'kitchen' in v[0];
}

export function fromLegacy(b: LegacyBundle, photoRef: (file: string) => string | null): { reports: Report[]; caps: Cap[] } {
  const now = new Date().toISOString();
  const reports: Report[] = [], caps: Cap[] = [];
  for (const a of b.audits) {
    const items = a.items.map((i) => ({
      cid: i.cap?.cid ?? '', section: i.section, subsection: i.subsection, question: i.question, short: i.short,
      criticality: (['Critical', 'Major', 'Minor'].includes(i.criticality) ? i.criticality : 'Unrated') as Crit,
      points: i.points ?? POINTS[i.criticality as Crit] ?? 0, comment: i.comment, findings: i.findings,
      photos: i.photos.map(photoRef).filter((x): x is string => !!x),
    }));
    // A CAP-only audit (no report yet) has no score; keep it as a CAP only.
    if (a.source !== 'cap') {
      reports.push({ kind: 'report', id: '', community: a.community, kitchen: a.kitchen, city: a.city, date: a.date, score: a.score,
        manager: a.manager, hdDate: isoDate(a.hd_date) || a.hd_date, hdResult: a.hd_result, positive: a.positive, items,
        file: a.file ?? 'Previous review page', source: 'legacy', warnings: [], importedAt: now });
    }
    if (a.cap) {
      caps.push({ kind: 'cap', id: '', community: a.community, kitchen: a.kitchen, auditDate: a.date, status: a.cap.status,
        submitted: isoDate(a.cap.submitted), approved: isoDate(a.cap.approved), completed: '', file: a.cap.file, source: 'legacy', warnings: [], importedAt: now,
        items: a.items.filter((i) => i.cap).map((i) => ({ cid: i.cap!.cid, question: i.question, action: i.cap!.action, update: i.cap!.update,
          owner: i.cap!.owner, due: isoDate(i.cap!.due), touch: i.subsection, comment: a.source === 'cap' ? i.comment : '', subs: a.source === 'cap' ? i.findings : [],
          photos: a.source === 'cap' ? items[a.items.indexOf(i)]?.photos ?? [] : [] })) });
    }
  }
  return { reports, caps };
}
