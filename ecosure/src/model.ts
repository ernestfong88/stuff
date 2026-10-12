/**
 * Turns stored records into what the pages show: one Audit per kitchen visit with its CAP
 * attached, plus a status per community (does it need an audit, does it need a CAP).
 */
import { POINTS, allStandards, critFor, findStandard, sectionFor, shortLabel, themeOf } from './catalog';
import ROSTER from './data/roster.json';
import type { Cap, CapItem, Community, Crit, Item, Rec, Report, Round, SelfAudit, Settings } from './types';
import { addDays, avg, daysBetween, norm, slug, todayIso } from './util';

export const DEFAULT_SETTINGS: Settings = {
  roster: ROSTER as Community[],
  rounds: [
    { name: 'Q3 2026', start: '2026-07-01', end: '2026-10-09' },
    { name: 'Q4 2026', start: '2026-10-10', end: '2026-12-31' },
    { name: 'Q1 2027', start: '2027-01-01', end: '2027-03-31' },
  ],
  capDueDays: 10,
  cycleDays: 100,
  selfAuditDays: 30,
  updatedAt: '',
};

export type CapState = 'not-needed' | 'missing' | 'late' | 'open' | 'overdue' | 'closed';
export const CAP_LABEL: Record<CapState, string> = {
  'not-needed': 'No CAP needed', missing: 'CAP missing', late: 'CAP missing', open: 'CAP in progress', overdue: 'CAP past due', closed: 'CAP closed',
};

/** True when a kitchen has findings but no CAP on file, whether or not it is late yet. */
export const capMissing = (a: Audit): boolean => a.capState === 'missing' || a.capState === 'late';

/** "CAP missing · 6 days late" or "CAP missing · due Oct 17". */
export function capMissingText(a: Audit, today: string): string {
  const d = Math.round((Date.parse(today) - Date.parse(a.capDue)) / 86400000);
  const [, mo, da] = a.capDue.split('-').map(Number);
  const due = `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][mo - 1]} ${da}`;
  return a.capState === 'late' ? `CAP missing · ${d === 1 ? '1 day' : d + ' days'} late` : `CAP missing · due ${due}`;
}
/** Worst first. */
export const CAP_ORDER: CapState[] = ['late', 'overdue', 'missing', 'open', 'closed', 'not-needed'];
export const CAP_TONE: Record<CapState, 'bad' | 'warn' | 'good' | 'none'> = { late: 'bad', overdue: 'bad', missing: 'bad', open: 'warn', closed: 'good', 'not-needed': 'none' };

export type AuditState = 'never' | 'overdue' | 'due' | 'pending-report' | 'done';
export const AUDIT_LABEL: Record<AuditState, string> = {
  never: 'Never audited', overdue: 'Audit overdue', due: 'Due this round', 'pending-report': 'Waiting on report', done: 'Audited this round',
};
export const AUDIT_TONE: Record<AuditState, 'bad' | 'warn' | 'good' | 'none'> = { never: 'bad', overdue: 'bad', due: 'warn', 'pending-report': 'none', done: 'good' };

export interface Finding extends Item {
  key: string;
  audit: Audit;
  capItem: CapItem | null;
  repeat: boolean; // same standard was cited at this kitchen's previous audit
}

export interface Audit {
  key: string;
  community: string;
  slug: string;
  kitchen: string;
  city: string;
  date: string;
  round: string;
  score: number | null;
  pointsLost: number;
  manager: string;
  hdDate: string;
  hdResult: string;
  positive: string[];
  report: Report | null;
  cap: Cap | null;
  items: Finding[];
  capState: CapState;
  capDue: string;
  capMatched: number;
  capUnmatched: CapItem[];
  pastDueItems: number;
  crit: number;
}

export interface CommunityView {
  c: Community;
  slug: string;
  audits: Audit[]; // oldest first
  latest: Audit[]; // most recent audit per kitchen
  lastDate: string;
  score: number | null; // average of the latest audit per kitchen
  prevScore: number | null; // average of each kitchen's audit before that
  auditState: AuditState;
  nextDue: string;
  daysSince: number | null;
  capState: CapState; // worst across latest audits
  openFindings: number;
  critLatest: number;
  repeats: number;
  self: SelfAudit | null; // latest self-audit (any kitchen)
  readiness: number | null; // 0-100 from the latest self-audit
  selfState: 'none' | 'due' | 'current';
}

export interface Model {
  settings: Settings;
  today: string;
  currentRound: Round | null;
  audits: Audit[];
  findings: Finding[];
  communities: CommunityView[];
  bySlug: Map<string, CommunityView>;
  unknown: string[]; // communities in data but not on the roster
  selfAudits: SelfAudit[];
}

/** Points-weighted share of applicable checklist items that passed. */
export function readiness(sa: SelfAudit): number | null {
  let got = 0, all = 0;
  for (const s of allStandards()) {
    const r = sa.results[s.short]?.r;
    if (!r || r === 'na') continue;
    const w = POINTS[(s.crit || 'Minor') as Crit] || 1;
    all += w;
    if (r === 'pass') got += w;
  }
  return all ? (got / all) * 100 : null;
}

export interface Priority {
  short: string;
  theme: string;
  crit: Crit;
  points: number; // total points lost
  impact: number; // average points per audited kitchen: what fixing it everywhere adds to the average score
  kitchens: number;
  communities: string[];
  critical: number;
  repeats: number;
  findings: Finding[];
}

/** Standards ranked by how many points they cost across the given audits. */
export function priorities(audits: Audit[]): Priority[] {
  const scored = audits.filter((a) => a.score != null || a.items.length);
  const by = new Map<string, Finding[]>();
  for (const f of scored.flatMap((a) => a.items)) by.set(f.short, [...(by.get(f.short) ?? []), f]);
  return [...by.entries()].map(([short, fs]) => {
    const points = fs.reduce((x, f) => x + f.points, 0);
    return {
      short, theme: themeOf(short), crit: fs[0].criticality, points, impact: points / Math.max(1, scored.length),
      kitchens: new Set(fs.map((f) => f.audit.community + '|' + f.audit.kitchen)).size, communities: [...new Set(fs.map((f) => f.audit.community))].sort(),
      critical: fs.filter((f) => f.criticality === 'Critical').length, repeats: fs.filter((f) => f.repeat).length, findings: fs,
    };
  }).sort((a, b) => b.points - a.points || b.kitchens - a.kitchens);
}

export const isClosed = (status: string) => /^(approved|completed|closed)$/i.test(status.trim());

export function roundOf(date: string, rounds: Round[]): string {
  return rounds.find((r) => date >= r.start && date <= r.end)?.name ?? date.slice(0, 7);
}

export function currentRound(rounds: Round[], today: string): Round | null {
  return rounds.find((r) => today >= r.start && today <= r.end) ?? [...rounds].filter((r) => r.start <= today).pop() ?? null;
}

export function scoreBand(s: number | null): 'good' | 'warn' | 'bad' | 'none' {
  return s == null ? 'none' : s >= 85 ? 'good' : s >= 70 ? 'warn' : 'bad';
}

/** Map a name as printed by EcoSure to the roster name. */
export function canonical(name: string, roster: Community[]): string {
  const n = norm(name);
  const hit = roster.find((c) => norm(c.name) === n || c.aliases.some((a) => norm(a) === n));
  return hit?.name ?? name.trim();
}

const qMatch = (a: string, b: string) => { const x = norm(a), y = norm(b); return !!x && !!y && (x.startsWith(y.slice(0, 40)) || y.startsWith(x.slice(0, 40))); };

/** Merge seed and stored records: a stored record replaces the seed one with the same id; a tombstone hides it. */
export function mergeRecords(seed: Rec[], stored: Rec[]): Rec[] {
  const m = new Map<string, Rec>();
  for (const r of seed) m.set(r.id, r);
  for (const r of stored) m.set(r.id, r);
  return [...m.values()].filter((r) => !r.deleted);
}

export function buildModel(recs: Rec[], settings: Settings, today = todayIso()): Model {
  const roster = settings.roster;
  const reports = recs.filter((r): r is Report => r.kind === 'report');
  const selfAudits = recs.filter((r): r is SelfAudit => r.kind === 'self').map((r) => ({ ...r, community: canonical(r.community, roster) })).sort((a, b) => a.date.localeCompare(b.date));
  const caps = recs.filter((r): r is Cap => r.kind === 'cap').sort((a, b) => a.importedAt.localeCompare(b.importedAt));

  const audits: Audit[] = [];
  const mk = (community: string, kitchen: string, date: string, report: Report | null): Audit => {
    const name = canonical(community, roster);
    const c = roster.find((x) => x.name === name);
    return {
      key: `${slug(name)}|${kitchen}|${date}`, community: name, slug: slug(name), kitchen, city: report?.city || c?.city || '', date,
      round: roundOf(date, settings.rounds), score: report?.score ?? null, pointsLost: 0, manager: report?.manager ?? '', hdDate: report?.hdDate ?? '',
      hdResult: report?.hdResult ?? '', positive: report?.positive ?? [], report, cap: null, items: [], capState: 'not-needed', capDue: '',
      capMatched: 0, capUnmatched: [], pastDueItems: 0, crit: 0,
    };
  };
  const byKey = new Map<string, Audit>();
  for (const r of reports.sort((a, b) => a.importedAt.localeCompare(b.importedAt))) {
    const a = mk(r.community, r.kitchen, r.date, r);
    a.items = r.items.map((i, n) => ({ ...i, key: `${a.key}|${n}`, audit: a, capItem: null, repeat: false }));
    byKey.set(a.key, a);
  }

  for (const cap of caps) {
    const name = canonical(cap.community, roster);
    const same = [...byKey.values()].filter((a) => a.community === name && a.kitchen === cap.kitchen && a.report).sort((x, y) => x.date.localeCompare(y.date));
    let a = cap.auditDate ? same.find((x) => x.date === cap.auditDate) : undefined;
    if (!a && !cap.auditDate) a = same.filter((x) => !cap.submitted || x.date <= cap.submitted).pop() ?? same[same.length - 1];
    if (!a) {
      // No report yet: the CAP carries the findings, so build the audit from it.
      const date = cap.auditDate || cap.submitted;
      a = byKey.get(`${slug(name)}|${cap.kitchen}|${date}`) ?? mk(name, cap.kitchen, date, null);
      byKey.set(a.key, a);
      const host = a;
      a.items = cap.items.map((ci, n) => {
        const crit = critFor(ci.question, ci.cid);
        return { cid: ci.cid, section: sectionFor(ci.question, ci.cid), subsection: findStandard(ci.question, ci.cid)?.sub || ci.touch, question: ci.question,
          short: shortLabel(ci.question, ci.cid), criticality: crit, points: POINTS[crit], comment: ci.comment, findings: ci.subs, photos: ci.photos,
          key: `${host.key}|${n}`, audit: host, capItem: null, repeat: false };
      });
    }
    a.cap = cap;
  }

  for (const a of byKey.values()) {
    a.pointsLost = a.items.reduce((s, i) => s + i.points, 0);
    a.crit = a.items.filter((i) => i.criticality === 'Critical').length;
    a.capDue = addDays(a.date, settings.capDueDays);
    if (a.cap) {
      const used = new Set<CapItem>();
      for (const f of a.items) {
        const fcid = f.cid || findStandard(f.question)?.cid || '';
        const ci = a.cap.items.find((x) => !used.has(x) && x.cid && fcid && x.cid === fcid) ?? a.cap.items.find((x) => !used.has(x) && qMatch(x.question, f.question));
        if (ci) { f.capItem = ci; used.add(ci); }
      }
      a.capMatched = a.items.filter((f) => f.capItem).length;
      a.capUnmatched = a.cap.items.filter((x) => !used.has(x));
      const closed = isClosed(a.cap.status);
      a.pastDueItems = closed ? 0 : a.cap.items.filter((x) => x.due && x.due < today).length;
      a.capState = closed ? 'closed' : a.pastDueItems ? 'overdue' : 'open';
    } else if (a.items.length) {
      a.capState = today > a.capDue ? 'late' : 'missing';
    }
    audits.push(a);
  }
  audits.sort((x, y) => x.community.localeCompare(y.community) || x.kitchen.localeCompare(y.kitchen) || x.date.localeCompare(y.date));

  // Repeat findings: cited again at the same kitchen's next audit.
  const byKitchen = new Map<string, Audit[]>();
  for (const a of audits) { const k = a.community + '|' + a.kitchen; byKitchen.set(k, [...(byKitchen.get(k) ?? []), a]); }
  for (const list of byKitchen.values()) for (let i = 1; i < list.length; i++) {
    const prev = new Set(list[i - 1].items.map((f) => f.short));
    for (const f of list[i].items) f.repeat = prev.has(f.short);
  }

  const cur = currentRound(settings.rounds, today);
  const names = new Set([...roster.filter((c) => c.active).map((c) => c.name), ...audits.map((a) => a.community)]);
  const unknown = [...names].filter((n) => !roster.some((c) => c.name === n));
  const communities: CommunityView[] = [...names].sort((a, b) => a.localeCompare(b)).map((name) => {
    const c = roster.find((x) => x.name === name) ?? { name, short: name, city: audits.find((a) => a.community === name)?.city ?? '', kitchens: [], active: true, note: '', aliases: [] };
    const list = audits.filter((a) => a.community === name);
    const kitchens = [...new Set(list.map((a) => a.kitchen))];
    const latest = kitchens.map((k) => list.filter((a) => a.kitchen === k).pop()!).sort((x, y) => x.kitchen.localeCompare(y.kitchen));
    const prev = kitchens.map((k) => { const l = list.filter((a) => a.kitchen === k && a.score != null); return l.length > 1 ? l[l.length - 2] : null; });
    const lastDate = list.reduce((m, a) => (a.date > m ? a.date : m), '');
    const scored = latest.filter((a) => a.score != null);
    const nextDue = lastDate ? addDays(lastDate, settings.cycleDays) : '';
    let auditState: AuditState;
    if (!list.length) auditState = c.note ? 'pending-report' : 'never';
    else if (cur && lastDate >= cur.start) auditState = latest.some((a) => a.score == null && a.date >= cur.start) ? 'pending-report' : 'done';
    else if (c.note) auditState = 'pending-report';
    else if (nextDue && today > nextDue) auditState = 'overdue';
    else auditState = cur ? 'due' : 'done';
    const self = selfAudits.filter((x) => x.community === name).pop() ?? null;
    const selfState: CommunityView['selfState'] = !self ? 'none' : daysBetween(self.date, today) > (settings.selfAuditDays ?? 30) ? 'due' : 'current';
    const capState = latest.map((a) => a.capState).sort((x, y) => CAP_ORDER.indexOf(x) - CAP_ORDER.indexOf(y))[0] ?? 'not-needed';
    return {
      c, slug: slug(name), audits: list, latest, lastDate, score: avg(scored.map((a) => a.score)), prevScore: avg(prev.map((a) => a?.score)),
      auditState, nextDue, daysSince: lastDate ? daysBetween(lastDate, today) : null, capState,
      openFindings: latest.filter((a) => a.capState !== 'closed').reduce((s, a) => s + a.items.length, 0),
      critLatest: latest.reduce((s, a) => s + a.crit, 0), repeats: latest.reduce((s, a) => s + a.items.filter((f) => f.repeat).length, 0),
      self, readiness: self ? readiness(self) : null, selfState,
    };
  });

  return {
    settings, today, currentRound: cur, audits, findings: audits.flatMap((a) => a.items), communities,
    bySlug: new Map(communities.map((c) => [c.slug, c])), unknown, selfAudits,
  };
}

/** Communities that need an audit, most urgent first. */
export function needsAudit(m: Model): CommunityView[] {
  const rank: Record<AuditState, number> = { never: 0, overdue: 1, due: 2, 'pending-report': 3, done: 9 };
  return m.communities.filter((c) => c.c.active && c.auditState !== 'done')
    .sort((a, b) => rank[a.auditState] - rank[b.auditState] || (a.score ?? 101) - (b.score ?? 101) || a.c.name.localeCompare(b.c.name));
}

/** Kitchen audits whose CAP still needs work, most urgent first. */
export function needsCap(m: Model): Audit[] {
  const latestKeys = new Set(m.communities.flatMap((c) => c.latest.map((a) => a.key)));
  return m.audits.filter((a) => latestKeys.has(a.key) && a.capState !== 'closed' && a.capState !== 'not-needed')
    .sort((a, b) => CAP_ORDER.indexOf(a.capState) - CAP_ORDER.indexOf(b.capState) || a.capDue.localeCompare(b.capDue));
}
