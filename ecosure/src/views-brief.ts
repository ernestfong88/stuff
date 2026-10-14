/**
 * The briefing: one page in plain sentences that a regional or national leader can
 * read out loud. Every sentence is built from the data; nothing here is typed by hand.
 */
import { CAP_LABEL, capMissing, needsCap, priorities, type Audit, type CommunityView, type Finding, type Model } from './model';
import { PLAIN, plainTitle } from './plain';
import { PLAYBOOK } from './playbook';
import { photoUrl } from './store';
import { avg, esc, fmtDate, pct, plural } from './util';
import { inRound, latestPerKitchen, type ViewState } from './views';
import { communitiesOfFocus } from './views-roles';
import { OPEN, top } from './expand';

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : xs.slice(0, -1).join(', ') + (xs.length > 2 ? ',' : '') + ' and ' + xs[xs.length - 1]);
const rank = (c: string) => ['Critical', 'Major', 'Minor', 'Unrated'].indexOf(c);

/** One representative photo for a set of findings: critical first, then most recent. */
function bestPhoto(fs: Finding[]): { f: Finding; n: number } | null {
  const f = [...fs].filter((x) => x.photos.length).sort((a, b) => rank(a.criticality) - rank(b.criticality) || b.audit.date.localeCompare(a.audit.date))[0];
  return f ? { f, n: 0 } : null;
}
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
    crit: all.filter((f) => f.criticality === 'Critical').length, critClosed: all.filter((f) => f.criticality === 'Critical' && f.capItem && f.audit.capState === 'closed').length,
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

function nextSteps(b: Brief): string[] {
  const steps: string[] = [];
  const focus = [...b.focus].sort((x, y) => (x.c.score ?? 101) - (y.c.score ?? 101));
  if (focus.length) steps.push(`Visit or call the ${plural(focus.length, 'community', 'communities')} of focus, starting with ${focus[0].c.c.name}.`);
  if (b.missing.length || b.pastDue.length) steps.push('Close the loop on every violation: each cited kitchen submits its corrective action plan in EcoSure within 10 days of the audit.');
  const t = b.top[0];
  if (t) steps.push(`Make "${plainTitle(t.short).toLowerCase()}" a portfolio focus${PLAYBOOK[t.short] ? `: ${lower(PLAYBOOK[t.short].have[0])}` : ''}.`);
  return steps.slice(0, 3);
}

/** Remediated: the finding is on a CAP that EcoSure shows as Approved or Completed. */
const remediated = (fs: Finding[]) => fs.filter((f) => f.capItem && f.audit.capState === 'closed').length;

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
export function teamActions(fs: Finding[], n = 2): string[] {
  const acts = fs.map((f) => f.capItem?.action ?? '').filter(Boolean);
  return ACTION_THEMES.map(([re, label]) => ({ label, k: acts.filter((x) => re.test(x)).length }))
    .filter((x) => x.k >= 2).sort((a, b) => b.k - a.k).slice(0, n).map((x) => x.label);
}

export interface Snapshot { kitchens: number; found: number; done: number; rate: number; top: { title: string; kitchens: number; done: number; n: number; did: string[] }[] }
function snapshotOf(b: Brief): Snapshot {
  const items = b.A.flatMap((a) => a.items);
  const done = remediated(items);
  return {
    kitchens: b.A.length, found: items.length, done, rate: items.length ? Math.round((done / items.length) * 100) : 0,
    top: b.top.slice(0, 3).map((p) => ({ title: plainTitle(p.short), kitchens: p.kitchens, done: remediated(p.findings), n: p.findings.length, did: teamActions(p.findings) })),
  };
}
export const snapshot = (m: Model, v: ViewState, inReg: (name: string) => boolean): Snapshot => snapshotOf(compute(m, v, inReg));
const didText = (d: string[]) => (d.length ? d.join(', and ').replace(/^./, (c) => c.toUpperCase()) + '.' : 'Corrective plans in progress.');
export const snapshotDid = didText;

/** Top 5 issues with a photo each; expand one for why it matters and the fix. */
export function fixCard(m: Model, v: ViewState, inReg: (name: string) => boolean): string {
  const b = compute(m, v, inReg);
  if (!b.top.length) return '';
  const row = (key: string, sumHtml: string, body: string) => `<details class="xrow" data-fold="${key}"${OPEN.has('fold:' + key) ? ' open' : ''}><summary>${sumHtml}<span class="chev" aria-hidden="true"></span></summary><div class="xbody">${body}</div></details>`;
  return `<section class="xcard wide"><header><div><h3>Top 5 issues</h3><p>Ranked by points lost. Select one for why it matters, the fix and photos.</p></div><button class="linkbtn" data-go="priorities">All priorities</button></header><div class="xlist">${b.top.map((p, i) => {
    const ph = bestPhoto(p.findings);
    return row('issue-' + i, `<span class="rank">${i + 1}</span>${ph ? `<img src="${esc(photoUrl(ph.f.photos[0]))}" alt="" loading="lazy">` : '<span class="noimg"></span>'}<span class="xt"><b>${esc(plainTitle(p.short))}</b><span class="meter" aria-hidden="true"><span style="width:${(p.kitchens / b.A.length) * 100}%"></span></span></span><span class="xn"><b>${p.kitchens}</b> of ${b.A.length} kitchens</span>`,
      `<p>${esc(PLAIN[p.short]?.why ?? '')}</p>${PLAYBOOK[p.short] ? `<p><b>The fix:</b> ${esc(PLAYBOOK[p.short].have[0])}.</p>` : ''}
      ${ph ? `<div class="thumbs">${p.findings.filter((f) => f.photos.length).slice(0, 5).map((f) => `<button data-photo="${esc(f.key)}" data-n="0" aria-label="Open photo from ${esc(f.audit.community)}"><img loading="lazy" src="${esc(photoUrl(f.photos[0]))}" alt=""></button>`).join('')}</div>` : ''}
      <button class="linkbtn" data-act="std-photos:${esc(p.short)}">See all ${p.findings.length} findings</button>`);
  }).join('')}</div></section>`;
}

export function stepsCard(m: Model, v: ViewState, inReg: (name: string) => boolean): string {
  const steps = nextSteps(compute(m, v, inReg));
  return steps.length ? `<section class="xcard wide"><header><div><h3>Next steps</h3><p>What we are asking regional and community teams to do this month.</p></div><button class="linkbtn" data-go="playbook">Readiness playbook</button></header><ol class="steps">${steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></section>` : '';
}

/** The whole summary as a plain-text email, for executives who read it without the page. */
export function briefingText(m: Model, v: ViewState, link = '', inReg: (name: string) => boolean = () => true, region = ''): string {
  const b = compute(m, v, inReg);
  const sn = snapshotOf(b);
  return [`Subject: EcoSure food safety snapshot, ${b.A[0]?.round ?? ''} round${region ? `, ${region}` : ''}`, '',
    `This quarter EcoSure found ${sn.found} food safety violations across ${sn.kitchens} kitchens${region ? ` in ${region}` : ''}. Our teams have remediated ${sn.done} of them: a ${sn.rate}% remediation rate.`, '',
    'TOP 3 CHALLENGES AND WHAT TEAMS DID',
    ...sn.top.map((t, i) => `${i + 1}. ${t.title} (${t.kitchens} kitchens). ${didText(t.did)}`), '',
    ...(() => {
      const act = b.A.flatMap((a) => a.items).filter((f) => f.cid === '10.1.1' || f.short === 'No critical pest activity');
      const names = [...new Set(act.map((f) => f.audit.community))];
      return ['PEST ACTIVITY', names.length ? `- Found at ${list(names.map((n) => { const fs = act.filter((f) => f.audit.community === n); const done = fs.every((f) => f.capItem && f.audit.capState === 'closed'); return `${n} (${done ? 'remediated' : 'not yet remediated'})`; }))}.` : '- No pest activity found.', ''];
    })(),
    'COMMUNITIES OF FOCUS', ...[...b.focus].sort((x, y) => (x.c.score ?? 101) - (y.c.score ?? 101)).slice(0, 5).map(({ c }) => `- ${c.c.name}: ${helpLine(c)}`), '',
    ...(!region ? ['AVERAGE SCORE BY REGION', ...b.regions.map((r) => `- ${r.name}: ${pct(r.s)}`), ''] : []),
    'NEXT STEPS', ...nextSteps(b).map((x, i) => `${i + 1}. ${x}`),
    ...(link ? ['', `Full dashboard with photos: ${link}`] : [])].join('\n');
}

/* ---------- community talking points ---------- */
export function talkingPoints(c: CommunityView): string[] {
  const A = c.latest;
  if (!A.length) return [c.c.note || `${c.c.name} has no EcoSure audit on file yet.`];
  const out: string[] = [];
  const scored = A.filter((a) => a.score != null);
  const band = (s: number) => (s >= 85 ? 'a strong result' : s >= 70 ? 'in the middle range (70 to 84)' : 'below our 70 line, which makes it a community of focus');
  if (scored.length === 1 && A.length === 1) out.push(`${c.c.name} scored ${pct(scored[0].score)} on ${fmtDate(scored[0].date)}, ${band(scored[0].score!)}.`);
  else if (scored.length) out.push(`${c.c.name}'s ${A.length} kitchens scored ${list(A.map((a) => `${pct(a.score)} (${a.kitchen})`))} on ${fmtDate(c.lastDate)}. The average of ${pct(c.score)} is ${band(c.score!)}.`);
  else out.push(`${c.c.name} was audited on ${fmtDate(c.lastDate)}. The score is pending until the EcoSure report arrives.`);
  if (c.score != null && c.prevScore != null) { const d = Math.round(c.score - c.prevScore); out[0] += d === 0 ? ' That is the same as the last audit.' : ` That is ${Math.abs(d)} points ${d > 0 ? 'better' : 'lower'} than the last audit.`; }
  const items = A.flatMap((a) => a.items);
  const tops = [...new Map(items.sort((a, b) => b.points - a.points || rank(a.criticality) - rank(b.criticality)).map((f) => [f.short, f])).values()].slice(0, 3);
  if (tops.length) out.push(`The biggest issues were ${list(tops.map((f) => lower(plainTitle(f.short))))}.${c.critLatest ? ` ${plural(c.critLatest, 'finding was', 'findings were')} critical.` : ''}`);
  const reps = [...new Set(items.filter((f) => f.repeat).map((f) => lower(plainTitle(f.short))))];
  if (reps.length) out[out.length - 1] += ` Repeated from the last audit: ${list(reps)}.`;
  const withAction = items.filter((f) => f.capItem).length;
  if (items.length) out.push(c.capState === 'closed' ? `The corrective action plan is closed: ${withAction} of ${items.length} findings have a written action.` : c.capState === 'late' ? `No CAP on file and it is late (was due ${fmtDate(A[0].capDue)}). Ask the team to submit it in EcoSure this week.` : c.capState === 'overdue' ? `The corrective action plan has items past their due date (${CAP_LABEL[c.capState].toLowerCase()}). ${withAction} of ${items.length} findings have a written action.` : c.capState === 'missing' ? `No CAP on file yet. It is due ${fmtDate(A[0].capDue)}.` : `The corrective action plan is in progress: ${withAction} of ${items.length} findings have a written action.`);
  if (tops[0] && PLAYBOOK[tops[0].short]) out.push(`On your next visit: ${lower(PLAYBOOK[tops[0].short].check)}`);
  if (out.length < 5) out.push(c.self ? `Last self-audit: ${fmtDate(c.self.date)}, readiness ${c.readiness == null ? 'n/a' : Math.round(c.readiness) + '%'}.` : 'No self-audit yet. Ask the team to complete one this month.');
  return out.slice(0, 5);
}

export function talkingBlock(c: CommunityView): string {
  const pts = talkingPoints(c);
  const fs = c.latest.flatMap((a) => a.items).filter((f) => f.photos.length).sort((a, b) => rank(a.criticality) - rank(b.criticality) || b.points - a.points);
  const shots = top('photos-' + c.slug, fs, 5, 'photos');
  return `<section class="talk"><h3>Talking points</h3>
    <ul>${pts.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
    ${fs.length ? `<div class="strip">${shots.shown.map((f) => `<figure>${photoBtn(f, 0)}<figcaption>${esc(plainTitle(f.short))}</figcaption></figure>`).join('')}</div>${shots.more}` : ''}</section>`;
}

export function talkingText(c: CommunityView, link: string): string {
  return [`${c.c.name}: EcoSure food safety summary`, '', ...talkingPoints(c).map((p) => '- ' + p), '', `Full report: ${link}`].join('\n');
}

