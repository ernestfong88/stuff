import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { boRoleStore } from '../../../../store/boRole';
import { recipeApprovalsStore } from '../../../../store/recipeApprovals';
import { approveSubmission, denySubmission, getSubmissions } from '../../menus/approvals';
import { BO_ALIASES, BO_MORE_PAGES, BO_PAGES, BO_SECTIONS, HO_PAGE_IDS, canSee } from '../../nav';
import { attentionItems } from '../../pages/dashboard/model/attention';
import { BACK_OFFICE_USER, HOME_OFFICE_USER, backOfficeUser } from '../../seed/associates';
import { paletteEntries } from '../PagePalette';

describe('HO Settings: Home Office only', () => {
  it('is the HO Settings section, all five pages', () => {
    expect(BO_SECTIONS.filter((s) => s.homeOffice).map((s) => s.id)).toEqual(['ho']);
    expect(HO_PAGE_IDS).toEqual(['svcAlerts', 'svcMetrics', 'credits', 'recipeApproval', 'phases']);
  });

  it('hides every HO page from a community user and shows it to Home Office', () => {
    for (const id of HO_PAGE_IDS) {
      expect(canSee(id, 'community'), id).toBe(false);
      expect(canSee(id, 'homeOffice'), id).toBe(true);
    }
  });

  it('keeps every other page, opened-from page and old address open to everyone', () => {
    for (const p of [...BO_PAGES.filter((x) => !HO_PAGE_IDS.includes(x.id)), ...BO_MORE_PAGES]) expect(canSee(p.id, 'community'), p.id).toBe(true);
    for (const a of BO_ALIASES) expect(canSee(a.id, 'community'), a.id).toBe(HO_PAGE_IDS.includes(a.to[0]) ? false : true);
  });

  it('leaves HO pages out of page search for a community user, aliases included', () => {
    const community = paletteEntries('community').map((e) => e.id);
    expect(community.some((id) => HO_PAGE_IDS.includes(id))).toBe(false);
    expect(paletteEntries('community').some((e) => e.sectionDef.homeOffice)).toBe(false);
    const ho = paletteEntries('homeOffice').map((e) => e.id);
    for (const id of HO_PAGE_IDS) expect(ho).toContain(id);
    expect(ho.length).toBeGreaterThan(community.length);
  });

  it('shows the recipes waiting for approval on the dashboard to Home Office only', () => {
    const base = { out: [], lateTickets: 2, lateMinutes: 15, waiversUsedUp: [], chargesToReview: 0, amountToReview: 0, venues: [], menus: [], at: 0, recipesWaiting: 3 };
    expect(attentionItems(base).map((i) => i.kind)).toEqual(['late']);
    expect(attentionItems({ ...base, homeOffice: true }).map((i) => i.kind)).toEqual(['late', 'recipes']);
    // Late tickets: the mark is Home Office's, so plain text instead of a link into Shift Metrics.
    expect(attentionItems(base)[0].goto).toBeUndefined();
    expect(attentionItems(base)[0].note).toBe('Late after 15 min, set by Home Office');
  });
});

describe('Home Office user', () => {
  afterEach(() => {
    boRoleStore.reset();
    recipeApprovalsStore.reset();
  });

  it('is the community user unless viewing as Home Office', () => {
    expect(boRoleStore.get()).toBe('community');
    expect(backOfficeUser()).toBe(BACK_OFFICE_USER);
    boRoleStore.set('homeOffice');
    expect(backOfficeUser()).toBe(HOME_OFFICE_USER);
  });

  it('records recipe approval decisions as Home Office', () => {
    boRoleStore.set('homeOffice');
    const [a, b] = getSubmissions().filter((x) => x.status === 'waiting');
    approveSubmission(a.id, 'Looks good');
    denySubmission(b.id, 'Too salty');
    const after = getSubmissions();
    expect(after.find((x) => x.id === a.id)?.decidedBy).toBe(HOME_OFFICE_USER.name);
    expect(after.find((x) => x.id === b.id)?.decidedBy).toBe(HOME_OFFICE_USER.name);
  });
});

/**
 * No screen outside HO Settings jumps into it: no goto('<HO page>'),
 * navigate('backoffice', ['<HO page>']), `page: '<HO page>'` link, `to:`
 * alias or #/backoffice/<HO page> address anywhere else in the app.
 */
describe('no shortcuts into HO Settings', () => {
  const SRC = join(__dirname, '../../../..');
  const HO_FILES = new Set(HO_PAGE_IDS.flatMap((id) => [`surfaces/backoffice/pages/${id}.tsx`, `surfaces/backoffice/pages/${id}/`]));
  // Shown only to Home Office (attentionItems' homeOffice flag, tested above), so the link is theirs.
  const ALLOWED = new Set(['surfaces/backoffice/pages/dashboard/model/attention.ts:recipeApproval']);
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) return f === '__tests__' ? [] : files(p);
      return /\.tsx?$/.test(f) ? [p] : [];
    });
  const ids = HO_PAGE_IDS.join('|');
  const LINK = new RegExp(
    `goto\\(\\s*['"](${ids})['"]|navigate\\(\\s*['"]backoffice['"]\\s*,\\s*\\[\\s*['"](${ids})['"]|page:\\s*['"](${ids})['"]|to:\\s*\\[\\s*['"](${ids})['"]|#/backoffice/(${ids})\\b`,
    'g',
  );

  it('finds no link to an HO page outside HO Settings', () => {
    const found: string[] = [];
    for (const file of files(SRC)) {
      const rel = relative(SRC, file).split('\\').join('/');
      if (rel === 'surfaces/backoffice/nav.ts' || [...HO_FILES].some((f) => rel === f || (f.endsWith('/') && rel.startsWith(f)))) continue;
      for (const m of readFileSync(file, 'utf8').matchAll(LINK)) {
        const id = m.slice(1).find(Boolean)!;
        if (!ALLOWED.has(`${rel}:${id}`)) found.push(`${rel}: ${m[0]}`);
      }
    }
    expect(found).toEqual([]);
  });
});
