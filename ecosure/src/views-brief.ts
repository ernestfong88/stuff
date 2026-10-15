/**
 * The executive summary pieces on the dashboard and community pages (snapshot, top challenges,
 * top 5 issues, next steps) and their plain-text email versions. Every line is built from the data.
 */
import { capMissing, needsCap, priorities, type Audit, type CommunityView, type Finding, type Model } from './model';
import { PLAIN, plainTitle } from './plain';
import { PLAYBOOK } from './playbook';
import { photoUrl } from './store';
import { avg, esc, fmtDate, pct, plural } from './util';
import { inRound, latestPerKitchen, type ViewState } from './views';
import { communitiesOfFocus } from './views-roles';
import { top } from './expand';
import { isActivity, isPest, isRemediated, pestStatus, remediated, status } from './views-common';
import { CAUTIONS, FOCUS, PATTERNS } from './cautions';

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const rank = (c: string) => ['Critical', 'Major', 'Minor', 'Unrated'].indexOf(c);

const photoBtn = (f: Finding, n: number, cls = '') => `<button class="ph ${cls}" data-photo="${esc(f.key)}" data-n="${n}" aria-label="Open photo: ${esc(plainTitle(f.short))} at ${esc(f.audit.community)}"><img loading="lazy" src="${esc(photoUrl(f.photos[n]))}" alt=""></button>`;

interface Brief {
  A: Audit[]; comms: number; s: number | null; good: number; warn: number; bad: number; start: string; end: string;
  top: ReturnType<typeof priorities>; topShare: number; focus: ReturnType<typeof communitiesOfFocus>;
  capKitchens: number; capClosed: number; late: Audit[]; pastDue: Audit[]; missing: Audit[];
  crit: number; critClosed: number; actions: number; photos: number; prev: { name: string; s: number | null } | null;
  regions: Region[]; reaudited: number; improved: number;
}

interface Region { name: string; comms: CommunityView[]; kitchens: number; s: number | null; bad: number; capClosed: number; capKitchens: number; capMissing: number }

function compute(m: Model, v: ViewState, inReg: (name: string) => boolean = () => true): Brief {
  const A = latestPerKitchen(inRound(m, v)).filter((a) => inReg(a.community));
  const scored = A.filter((a) => a.score != null);
  const P = priorities(A);
  const total = P.reduce((x, p) => x + p.points, 0);
  const topP = P.slice(0, 5);
  const nc = needsCap(m).filter((a) => inReg(a.community));
  const all = A.flatMap((a) => a.items);
  const rounds = [...new Set(m.audits.map((a) => a.round))];
  const cur = A[0]?.round;
  const prevName = rounds.filter((r) => r !== cur).sort((a, b) => m.settings.rounds.findIndex((x) => x.name === a) - m.settings.rounds.findIndex((x) => x.name === b)).pop();
  return {
    A, comms: new Set(A.map((a) => a.community)).size, s: avg(scored.map((a) => a.score)),
    good: scored.filter((a) => a.score! >= 85).length, warn: scored.filter((a) => a.score! >= 70 && a.score! < 85).length, bad: scored.filter((a) => a.score! < 70).length,
    start: A.reduce((x, a) => (!x || a.date < x ? a.date : x), ''), end: A.reduce((x, a) => (a.date > x ? a.date : x), ''),
    top: topP, topShare: total ? topP.reduce((x, p) => x + p.points, 0) / total : 0, focus: communitiesOfFocus(m).filter(({ c }) => inReg(c.c.name)),
    capKitchens: A.filter((a) => a.items.length).length, capClosed: A.filter((a) => a.capState === 'closed').length,
    late: nc.filter((a) => a.capState === 'late'), pastDue: nc.filter((a) => a.capState === 'overdue'),
    missing: A.filter(capMissing).sort((x, y) => x.capDue.localeCompare(y.capDue)),
    crit: all.filter((f) => f.criticality === 'Critical').length, critClosed: all.filter((f) => f.criticality === 'Critical' && f.capItem).length,
    actions: all.filter((f) => f.capItem).length, photos: all.reduce((x, f) => x + f.photos.length, 0),
    prev: prevName && prevName !== cur ? { name: prevName, s: avg(latestPerKitchen(m.audits.filter((a) => a.round === prevName && inReg(a.community))).map((a) => a.score)) } : null,
    regions: regionsOf(m, A),
    ...improvement(m),
  };
}

function regionsOf(m: Model, A: Audit[]): Region[] {
  const names = [...new Set(m.communities.filter((c) => c.c.active).map((c) => c.c.region || 'No region set'))];
  return names.map((name) => {
    const comms = m.communities.filter((c) => c.c.active && (c.c.region || 'No region set') === name).sort((a, b) => (a.score ?? 101) - (b.score ?? 101));
    const RA = A.filter((a) => comms.some((c) => c.c.name === a.community));
    const scored = RA.filter((a) => a.score != null);
    return { name, comms, kitchens: RA.length, s: avg(scored.map((a) => a.score)), bad: scored.filter((a) => a.score! < 70).length,
      capClosed: RA.filter((a) => a.capState === 'closed').length, capKitchens: RA.filter((a) => a.items.length).length, capMissing: RA.filter(capMissing).length };
  }).sort((a, b) => (a.s ?? 101) - (b.s ?? 101));
}

/** Kitchens with two scored audits, and how many of them went up. */
function improvement(m: Model): { reaudited: number; improved: number } {
  let reaudited = 0, improved = 0;
  for (const c of m.communities) for (const k of new Set(c.audits.map((a) => a.kitchen))) {
    const l = c.audits.filter((a) => a.kitchen === k && a.score != null);
    if (l.length < 2) continue;
    reaudited++;
    if (l[l.length - 1].score! > l[l.length - 2].score!) improved++;
  }
  return { reaudited, improved };
}

function helpLine(c: CommunityView): string {
  const parts: string[] = [];
  if (c.score != null) parts.push(`Scored ${Math.round(c.score)}`);
  if (c.critLatest) parts.push(`${plural(c.critLatest, 'critical finding')}`);
  if (c.repeats) parts.push(`${c.repeats} repeated from last time`);
  const top = c.latest.flatMap((a) => a.items).sort((a, b) => b.points - a.points)[0];
  const cap = c.capState === 'closed' ? 'Corrective actions are closed.' : c.capState === 'late' ? 'Its corrective action plan is late.' : c.capState === 'overdue' ? 'Some corrective actions are past due.' : c.capState === 'missing' ? 'Corrective action plan not started yet.' : c.capState === 'open' ? 'Corrective action plan in progress.' : '';
  return `${parts.join(', ')}.${top ? ` Biggest issue: ${lower(plainTitle(top.short))}.` : ''} ${cap}`;
}



/** What teams wrote in their corrective action plans, sorted into a few plain themes. */
const ACTION_THEMES: [RegExp, string][] = [
  [/clean|saniti|wash|delim|scrub|wipe/i, 'cleaned and sanitized'],
  [/replac|repair|work order|ordered|purchas|maintenance|new /i, 'repaired or replaced equipment'],
  [/train|in-?servic|expectation|educat|huddle|coach/i, 'retrained staff'],
  [/schedule|checklist|check list|closing dut|routine|daily|weekly|monthly/i, 'added it to a daily or weekly checklist'],
  [/discard|threw|thrown|toss|dispos/i, 'discarded unsafe food or items'],
  [/thermometer|calibrat|temp/i, 'checked temperatures'],
  [/label|dated/i, 'labeled and dated items'],
];

/** Each theme with the number of kitchens whose plan mentions it. */
export function teamThemes(fs: Finding[]): { label: string; k: number }[] {
  return ACTION_THEMES.map(([re, label]) => ({ label, k: new Set(fs.filter((f) => re.test(f.capItem?.action ?? '')).map((f) => f.audit.key)).size }))
    .filter((x) => x.k > 0).sort((a, b) => b.k - a.k).slice(0, 3);
}
/** One real corrective action, from a remediated plan when there is one, that reads well on its own. */
function example(fs: Finding[]): { text: string; who: string } | null {
  const good = (f: Finding) => (f.capItem?.action ?? '').length;
  const pick = [...fs].filter((f) => good(f) >= 40).sort((a, b) => Number(isRemediated(b)) - Number(isRemediated(a)) || Math.abs(good(a) - 140) - Math.abs(good(b) - 140))[0];
  if (!pick) return null;
  const t = pick.capItem!.action;
  return { text: t.length > 220 ? t.slice(0, 217).replace(/\s+\S*$/, '') + '...' : t, who: pick.audit.community };
}

export interface Challenge { short: string; title: string; crit: string; kitchens: number; n: number; share: number; region: { name: string; k: number } | null; mostly: string[]; focus: string; themes: { label: string; k: number }[]; example: { text: string; who: string } | null; why: string; cautions: string[] }
export interface Snapshot { kitchens: number; found: number; done: number; rate: number; top: Challenge[] }
function snapshotOf(b: Brief, m: Model): Snapshot {
  const regionOf = (name: string) => m.settings.roster.find((c) => c.name === name)?.region || '';
  const items = b.A.flatMap((a) => a.items);
  const done = remediated(items);
  return {
    kitchens: b.A.length, found: items.length, done, rate: items.length ? Math.round((done / items.length) * 100) : 0,
    top: b.top.slice(0, 3).map((p) => {
      return {
        short: p.short, title: plainTitle(p.short), crit: p.crit, kitchens: p.kitchens, n: p.findings.length,
        share: b.A.length ? Math.round((p.kitchens / b.A.length) * 100) : 0,
        region: (() => { const c = new Map<string, number>(); for (const f of p.findings) { const r = regionOf(f.audit.community); if (r) c.set(r, (c.get(r) ?? 0) + 1); } const top = [...c].sort((x, y) => y[1] - x[1])[0]; return top && c.size > 1 ? { name: top[0], k: top[1] } : null; })(),
        mostly: (PATTERNS[p.short] ?? []).map(([label, re]) => ({ label, k: new Set(p.findings.filter((f) => re.test((f.comment + ' ' + f.findings.join(' ')).toLowerCase())).map((f) => f.audit.key)).size })).filter((x) => x.k >= 2).sort((x, y) => y.k - x.k).slice(0, 2).map((x) => `${x.label} (${x.k})`),
        focus: FOCUS[p.short] ?? CAUTIONS[p.short]?.[0] ?? PLAYBOOK[p.short]?.check ?? '',
        themes: teamThemes(p.findings), example: example(p.findings),
        why: PLAIN[p.short]?.why ?? '', cautions: CAUTIONS[p.short] ?? (PLAYBOOK[p.short] ? [PLAYBOOK[p.short].check] : []),
      };
    }),
  };
}
export const snapshot = (m: Model, v: ViewState, inReg: (name: string) => boolean): Snapshot => snapshotOf(compute(m, v, inReg), m);



/** The whole summary as a plain-text email, for executives who read it without the page. */
export function briefingText(m: Model, v: ViewState, link = '', inReg: (name: string) => boolean = () => true, region = ''): string {
  const b = compute(m, v, inReg);
  const sn = snapshotOf(b, m);
  return [`Subject: EcoSure food safety snapshot, ${b.A[0]?.round ?? ''} round${region ? `, ${region}` : ''}`, '',
    `This quarter EcoSure found ${sn.found} food safety violations across ${sn.kitchens} kitchens${region ? ` in ${region}` : ''}. Our teams have remediated ${sn.done} of them: a ${sn.rate}% remediation rate.`, '',
    'TOP 3 CHALLENGES',
    ...sn.top.flatMap((t, i) => [`${i + 1}. ${t.title}: ${t.n} violations in ${t.kitchens} kitchens.`,
      `   What teams did: ${t.themes.length ? t.themes.map((x) => `${x.label} (${x.k} ${x.k === 1 ? 'kitchen' : 'kitchens'})`).join('; ') : 'corrective plans in progress'}.`,
      ...(t.example ? [`   For example, ${m.settings.roster.find((c) => c.name === t.example!.who)?.short || t.example.who}: "${t.example.text}"`] : []),
      ...(t.cautions.length ? [`   Our SMEs will focus on these with teams: ${t.cautions.join(' ')}`] : [])]), '',
    ...(() => {
      const act = b.A.flatMap((a) => a.items).filter((f) => f.cid === '10.1.1' || f.short === 'No critical pest activity');
      const names = [...new Set(act.map((f) => f.audit.community))];
      return ['PEST ACTIVITY', ...(names.length ? names.map((n) => { const fs = act.filter((f) => f.audit.community === n); return `- ${m.settings.roster.find((c) => c.name === n)?.short || n} (${pestStatus(fs)[0].toLowerCase()}): ${[...new Set(fs.map((f) => f.comment).filter(Boolean))].join(' ')}`; }) : ['- No pest activity found.']), ''];
    })(),
    'COMMUNITIES OF FOCUS', ...[...b.focus].sort((x, y) => (x.c.score ?? 101) - (y.c.score ?? 101)).slice(0, 5).map(({ c }) => `- ${c.c.short || c.c.name}: ${helpLine(c)}`), '',
    ...(!region ? ['AVERAGE SCORE BY REGION', ...b.regions.map((r) => `- ${r.name}: ${pct(r.s)}`), ''] : []),
    ...(link ? ['', `Full dashboard with photos: ${link}`] : [])].join('\n');
}

/* ---------- community snapshot ---------- */
export interface CommSnap {
  items: Finding[]; found: number; done: number; rate: number; pests: Finding[];
  top: { title: string; short: string; crit: string; kitchens: string[]; action: string; fs: Finding[] }[];
}
/** The same shape as the dashboard snapshot, for one community's audit. Top 3 are ranked by points lost. */
export function communitySnap(A: Audit[]): CommSnap {
  const items = A.flatMap((a) => a.items);
  const done = remediated(items);
  const groups = new Map<string, Finding[]>();
  for (const f of items) groups.set(f.short, [...(groups.get(f.short) ?? []), f]);
  const pts = (fs: Finding[]) => fs.reduce((x, f) => x + f.points, 0);
  const top = [...groups.values()].sort((a, b) => pts(b) - pts(a) || rank(a[0].criticality) - rank(b[0].criticality)).slice(0, 3).map((fs) => ({
    title: plainTitle(fs[0].short), short: fs[0].short, crit: [...fs].sort((a, b) => rank(a.criticality) - rank(b.criticality))[0].criticality,
    kitchens: [...new Set(fs.map((f) => f.audit.kitchen))], action: fs.find((f) => f.capItem?.action)?.capItem?.action ?? '', fs,
  }));
  return { items, found: items.length, done, rate: items.length ? Math.round((done / items.length) * 100) : 0, top, pests: items.filter(isPest) };
}

/** Up to five photos, critical first, with Show all. */
export function photoStrip(key: string, A: Audit[]): string {
  const fs = A.flatMap((a) => a.items).filter((f) => f.photos.length).sort((a, b) => rank(a.criticality) - rank(b.criticality) || b.points - a.points);
  if (!fs.length) return '';
  const shots = top('photos-' + key, fs, 5, 'photos');
  return `<div class="strip">${shots.shown.map((f) => `<figure>${photoBtn(f, 0)}<figcaption>${esc(plainTitle(f.short))}</figcaption></figure>`).join('')}</div>${shots.more}`;
}

/** The community snapshot as a plain-text email. */
export function talkingText(c: CommunityView, link: string): string {
  const A = c.latest;
  if (!A.length) return [`${c.c.name}: EcoSure food safety snapshot`, '', c.c.note || 'No EcoSure audit on file yet.', '', `Full report: ${link}`].join('\n');
  const sn = communitySnap(A);
  const n = (x: string) => sn.items.filter((f) => f.criticality === x).length;
  const act = sn.pests.filter(isActivity);
  return [`${c.c.name}: EcoSure food safety snapshot, audit of ${fmtDate(c.lastDate)}`, '',
    `EcoSure found ${sn.found} violations (${n('Critical')} critical, ${n('Major')} major, ${n('Minor')} minor). The team has remediated ${sn.done} of them: a ${sn.rate}% remediation rate.`,
    `Score: ${pct(c.score)}${A.length > 1 ? ` (${A.map((a) => `${a.kitchen} ${pct(a.score)}`).join(', ')})` : ''}.`,
    ...(act.length ? ['', `PEST ACTIVITY: ${act.map((f) => `${f.audit.kitchen}: ${f.comment || plainTitle(f.short)} (${status([f])[0].toLowerCase()})`).join('; ')}`] : []), '',
    'TOP 3 CHALLENGES AND WHAT THE TEAM DID',
    ...sn.top.map((t, i) => `${i + 1}. ${t.title} (${t.crit}${A.length > 1 ? `, ${t.kitchens.join(' and ')}` : ''}). ${t.action ? `Team's action: ${t.action.length > 200 ? t.action.slice(0, 197) + '...' : t.action}` : 'No corrective action written yet.'} Status: ${status(t.fs)[0].toLowerCase()}.`), '',
    `Full report: ${link}`].join('\n');
}
