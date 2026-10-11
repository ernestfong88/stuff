import { describe, expect, it } from 'vitest';
import { THEMES, allStandards } from '../src/catalog';
import { existsSync, readFileSync } from 'node:fs';
import { DEFAULT_SETTINGS, buildModel, mergeRecords, needsAudit, needsCap } from '../src/model';
import { fromLegacy, type LegacyBundle } from '../src/parse/legacy';
import { recId } from '../src/store';
import type { Cap, Item, Rec, Report } from '../src/types';
import { isoDate, splitUnit } from '../src/util';

const item = (q: string, crit: Item['criticality'], cid = ''): Item => ({ cid, section: 'Chemicals', subsection: '', question: q, short: q, criticality: crit, points: { Critical: 5, Major: 3, Minor: 1, Unrated: 0 }[crit], comment: '', findings: [], photos: [] });
const report = (p: Partial<Report>): Report => ({ kind: 'report', id: '', community: 'Test Place', kitchen: 'Main Kitchen', city: 'Town', date: '2026-09-01', score: 92, manager: '', hdDate: '', hdResult: '', positive: [], items: [], file: 'x.pdf', source: 'pdf', warnings: [], importedAt: '2026-09-02T00:00:00Z', ...p });
const cap = (p: Partial<Cap>): Cap => ({ kind: 'cap', id: '', community: 'Test Place', kitchen: 'Main Kitchen', auditDate: '2026-09-01', status: 'Pending', submitted: '2026-09-05', approved: '', completed: '', items: [], file: 'c.pdf', source: 'pdf', warnings: [], importedAt: '2026-09-06T00:00:00Z', ...p });
const withIds = (rs: Rec[]) => rs.map((r) => ({ ...r, id: recId(r) }));
const settings = { ...DEFAULT_SETTINGS, roster: [{ name: 'Test Place', short: 'Test', city: 'Town', kitchens: ['Main Kitchen'], active: true, note: '', aliases: ['Test Place Inc'] }] };

describe('dates and names', () => {
  it('reads the date formats EcoSure uses', () => {
    expect(isoDate('09/22/2026 08:00 AM')).toBe('2026-09-22');
    expect(isoDate('Sep-17-2026')).toBe('2026-09-17');
    expect(isoDate('2026-10-01')).toBe('2026-10-01');
    expect(isoDate('nonsense')).toBe('');
  });
  it('splits kitchen numbers off the unit name', () => {
    expect(splitUnit('Balfour Louisville - Kitchen #2')).toEqual({ community: 'Balfour Louisville', kitchen: 'Kitchen 2' });
    expect(splitUnit('Crestavilla')).toEqual({ community: 'Crestavilla', kitchen: null });
  });
});

describe('CAP status', () => {
  const r = report({ items: [item('Chemicals are properly labeled', 'Major', '8.2.1'), item('Chemicals are properly stored', 'Minor', '8.2.2')] });
  it('flags a missing CAP, then a late one after the due window', () => {
    const early = buildModel(withIds([r]), settings, '2026-09-05');
    expect(early.audits[0].capState).toBe('missing');
    const late = buildModel(withIds([r]), settings, '2026-09-30');
    expect(late.audits[0].capState).toBe('late');
    expect(needsCap(late)).toHaveLength(1);
  });
  it('matches CAP lines by client id and treats Approved and Completed as closed', () => {
    const c = cap({ status: 'Approved', items: [{ cid: '8.2.1', question: 'something else', action: 'Labeled', update: '', owner: 'A', due: '2026-09-08', touch: '', comment: '', subs: [], photos: [] }] });
    const m = buildModel(withIds([r, c]), settings, '2026-09-30');
    expect(m.audits[0].capState).toBe('closed');
    expect(m.audits[0].capMatched).toBe(1);
    expect(m.audits[0].items[0].capItem?.action).toBe('Labeled');
  });
  it('marks an open CAP past due when an item due date has passed', () => {
    const c = cap({ items: [{ cid: '', question: 'Chemicals are properly stored', action: 'Moved', update: '', owner: 'A', due: '2026-09-08', touch: '', comment: '', subs: [], photos: [] }] });
    expect(buildModel(withIds([r, c]), settings, '2026-09-07').audits[0].capState).toBe('open');
    expect(buildModel(withIds([r, c]), settings, '2026-09-09').audits[0].capState).toBe('overdue');
  });
  it('builds an audit from a CAP when the report has not arrived', () => {
    const c = cap({ community: 'Test Place Inc', auditDate: '2026-10-01', items: [{ cid: '8.2.1', question: 'Chemicals are properly labeled', action: 'x', update: '', owner: '', due: '', touch: '', comment: 'c', subs: ['s'], photos: [] }] });
    const m = buildModel(withIds([c]), settings, '2026-10-02');
    expect(m.audits).toHaveLength(1);
    expect(m.audits[0].community).toBe('Test Place');
    expect(m.audits[0].score).toBeNull();
    expect(m.audits[0].items[0].criticality).toBe('Major');
  });
});

describe('audit status and repeats', () => {
  const s = { ...settings, rounds: [{ name: 'R1', start: '2026-07-01', end: '2026-09-30' }, { name: 'R2', start: '2026-10-01', end: '2026-12-31' }] };
  it('is due when not audited in the current round, done once it is', () => {
    const recs = withIds([report({ date: '2026-08-01' })]);
    expect(buildModel(recs, s, '2026-10-05').communities[0].auditState).toBe('due');
    expect(needsAudit(buildModel(recs, s, '2026-10-05'))).toHaveLength(1);
    const both = withIds([report({ date: '2026-08-01' }), report({ date: '2026-10-03' })]);
    expect(buildModel(both, s, '2026-10-05').communities[0].auditState).toBe('done');
  });
  it('is overdue after the audit cycle', () => {
    expect(buildModel(withIds([report({ date: '2026-07-01' })]), s, '2026-11-15').communities[0].auditState).toBe('overdue');
  });
  it('flags standards cited again at the next audit', () => {
    const recs = withIds([report({ date: '2026-08-01', score: 97, items: [item('Chemicals are properly labeled', 'Major')] }), report({ date: '2026-10-03', score: 96, items: [item('Chemicals are properly labeled', 'Major'), item('Chemicals are properly stored', 'Minor')] })]);
    const m = buildModel(recs, s, '2026-10-05');
    expect(m.communities[0].repeats).toBe(1);
    expect(m.communities[0].score).toBe(96);
    expect(m.communities[0].prevScore).toBe(97);
  });
  it('lets a stored record replace or hide a seed record', () => {
    const seed = withIds([report({ score: 80 })]);
    expect(mergeRecords(seed, withIds([report({ score: 85 })]))[0]).toMatchObject({ score: 85 });
    expect(mergeRecords(seed, [{ ...seed[0], deleted: true }])).toHaveLength(0);
  });
});

const SEED = new URL('../src/data/legacy-seed.json', import.meta.url);
describe.skipIf(!existsSync(SEED))('starting data from the previous review page', () => {
  const b = (existsSync(SEED) ? JSON.parse(readFileSync(SEED, 'utf8')) : { audits: [], photos: {} }) as LegacyBundle;
  const { reports, caps } = fromLegacy(b, (n) => (b.photos[n] ? 'seed:' + n : null));
  const recs = withIds([...reports, ...caps]);
  const m = buildModel(recs, DEFAULT_SETTINGS, '2026-10-11');
  it('keeps every audit, finding and photo', () => {
    expect(m.audits).toHaveLength(b.audits.length);
    expect(m.findings).toHaveLength(b.audits.reduce((s, a) => s + a.items.length, 0));
    expect(m.findings.reduce((s, f) => s + f.photos.length, 0)).toBe(b.audits.reduce((s, a) => s + a.items.reduce((t, i) => t + i.photos.length, 0), 0));
  });
  it('keeps scores consistent with points lost', () => {
    for (const a of m.audits) if (a.score != null) expect(a.score).toBe(100 - a.pointsLost);
  });
  it('attaches every CAP line to a finding', () => {
    for (const a of m.audits) expect(a.capUnmatched).toHaveLength(0);
  });
  it('has every community on the roster and every short label in a theme', () => {
    expect(m.unknown).toEqual([]);
    const themed = new Set(THEMES.flatMap((t) => t.s));
    expect(allStandards().filter((s) => !themed.has(s.short)).map((s) => s.short)).toEqual([]);
  });
});
