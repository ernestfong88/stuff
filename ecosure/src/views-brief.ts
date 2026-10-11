/**
 * The briefing: one page in plain sentences that a regional or national leader can
 * read out loud. Every sentence is built from the data; nothing here is typed by hand.
 */
import { allStandards } from './catalog';
import { CAP_LABEL, currentRound, needsCap, priorities, type Audit, type CommunityView, type Finding, type Model } from './model';
import { PLAIN, plainTitle } from './plain';
import { PLAYBOOK } from './playbook';
import { photoUrl } from './store';
import { avg, esc, fmtDate, pct, plural } from './util';
import { inRound, latestPerKitchen, scorePill, type ViewState } from './views';
import { communitiesOfFocus } from './views-roles';
import { OPEN, fold, top } from './expand';

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
  capKitchens: number; capClosed: number; late: Audit[]; pastDue: Audit[];
  crit: number; critClosed: number; actions: number; photos: number; prev: { name: string; s: number | null } | null;
}

function compute(m: Model, v: ViewState): Brief {
  const A = latestPerKitchen(inRound(m, v));
  const scored = A.filter((a) => a.score != null);
  const P = priorities(A);
  const total = P.reduce((x, p) => x + p.points, 0);
  const topP = P.slice(0, 5);
  const nc = needsCap(m);
  const all = m.findings;
  const rounds = [...new Set(m.audits.map((a) => a.round))];
  const cur = A[0]?.round;
  const prevName = rounds.filter((r) => r !== cur).sort((a, b) => m.settings.rounds.findIndex((x) => x.name === a) - m.settings.rounds.findIndex((x) => x.name === b)).pop();
  return {
    A, comms: new Set(A.map((a) => a.community)).size, s: avg(scored.map((a) => a.score)),
    good: scored.filter((a) => a.score! >= 85).length, warn: scored.filter((a) => a.score! >= 70 && a.score! < 85).length, bad: scored.filter((a) => a.score! < 70).length,
    start: A.reduce((x, a) => (!x || a.date < x ? a.date : x), ''), end: A.reduce((x, a) => (a.date > x ? a.date : x), ''),
    top: topP, topShare: total ? topP.reduce((x, p) => x + p.points, 0) / total : 0, focus: communitiesOfFocus(m),
    capKitchens: A.filter((a) => a.items.length).length, capClosed: A.filter((a) => a.capState === 'closed').length,
    late: nc.filter((a) => a.capState === 'late'), pastDue: nc.filter((a) => a.capState === 'overdue'),
    crit: all.filter((f) => f.criticality === 'Critical').length, critClosed: all.filter((f) => f.criticality === 'Critical' && f.capItem && f.audit.capState === 'closed').length,
    actions: all.filter((f) => f.capItem).length, photos: all.reduce((x, f) => x + f.photos.length, 0),
    prev: prevName && prevName !== cur ? { name: prevName, s: avg(latestPerKitchen(m.audits.filter((a) => a.round === prevName)).map((a) => a.score)) } : null,
  };
}

/** A one-line read on a community for the "where to help" list. */
function helpLine(c: CommunityView): string {
  const parts: string[] = [];
  if (c.score != null) parts.push(`Scored ${Math.round(c.score)}`);
  if (c.critLatest) parts.push(`${plural(c.critLatest, 'critical finding')}`);
  if (c.repeats) parts.push(`${c.repeats} repeated from last time`);
  const top = c.latest.flatMap((a) => a.items).sort((a, b) => b.points - a.points)[0];
  const cap = c.capState === 'closed' ? 'Corrective actions are closed.' : c.capState === 'late' ? 'Its corrective action plan is late.' : c.capState === 'overdue' ? 'Some corrective actions are past due.' : c.capState === 'missing' ? 'Corrective action plan not started yet.' : c.capState === 'open' ? 'Corrective action plan in progress.' : '';
  return `${parts.join(', ')}.${top ? ` Biggest issue: ${lower(plainTitle(top.short))}.` : ''} ${cap}`;
}

const kitchenName = (a: Audit) => (a.kitchen === 'Main Kitchen' ? a.community : `${a.community} (${a.kitchen})`);

export function briefing(m: Model, v: ViewState): string {
  const b = compute(m, v);
  const cur = currentRound(m.settings.rounds, m.today);
  if (!b.A.length) return '<div class="empty">No audits yet. Add EcoSure reports on the Import files page.</div>';
  const roundName = b.A[0].round;
  const seg = (n: number, cls: string, label: string) => (n ? `<span class="bandseg ${cls}" style="flex:${n}" title="${n} ${label}"><b>${n}</b> ${label}</span>` : '');
  const help = top('brief-help', b.focus, 5, 'communities');
  const follow = top('brief-follow', [...b.late.map((a) => ({ a, t: 'No plan yet' })), ...b.pastDue.map((a) => ({ a, t: 'Items past due' }))], 5, 'kitchens');
  return `<div class="brief">
    <div class="pagehead"><div><p class="crumb">${esc(roundName)} round · ${fmtDate(b.start, true)} to ${fmtDate(b.end)}</p><h2 class="page">Food safety briefing</h2></div>
      <div class="pageacts"><button class="btn ghost sm" data-act="share">Copy link</button><button class="btn sm" data-act="copy-summary">Copy as email</button></div></div>

    <section class="bsec lead"><p class="big">${b.A.length} kitchens audited. Average score <b>${pct(b.s)}</b>${b.prev?.s != null ? `, ${b.s! >= b.prev.s ? 'up' : 'down'} from ${pct(b.prev.s)}` : ''}.</p>
      <div class="bandbar" role="img" aria-label="${b.good} kitchens scored 85 or better, ${b.warn} scored 70 to 84, ${b.bad} scored below 70">${seg(b.good, 'good', '85 or better')}${seg(b.warn, 'warn', '70 to 84')}${seg(b.bad, 'bad', 'below 70')}</div></section>

    <section class="bsec"><h3><span class="step">1</span>Top 5 things to fix</h3>
      <p class="note">These five make up ${Math.round(b.topShare * 100)}% of all points lost. Select one for why it matters and the fix.</p>
      <div class="issues">${b.top.map((p, i) => {
        const ph = bestPhoto(p.findings);
        return `<details class="irow" data-fold="issue-${i}"${OPEN.has('fold:issue-' + i) ? ' open' : ''}><summary><span class="rank">${i + 1}</span>${ph ? `<img src="${esc(photoUrl(ph.f.photos[0]))}" alt="" loading="lazy">` : '<span class="noimg"></span>'}<span class="it"><b>${esc(plainTitle(p.short))}</b><span>Found in ${p.kitchens} of ${b.A.length} kitchens</span></span></summary>
          <div class="ibody"><p>${esc(PLAIN[p.short]?.why ?? '')}</p>${PLAYBOOK[p.short] ? `<p><b>The fix:</b> ${esc(PLAYBOOK[p.short].have[0])}.</p>` : ''}
          ${ph ? `<div class="thumbs">${p.findings.filter((f) => f.photos.length).slice(0, 5).map((f) => `<button data-photo="${esc(f.key)}" data-n="0" aria-label="Open photo from ${esc(f.audit.community)}"><img loading="lazy" src="${esc(photoUrl(f.photos[0]))}" alt=""></button>`).join('')}</div>` : ''}
          <button class="linkbtn" data-act="std-photos:${esc(p.short)}">See all ${p.findings.length} findings</button></div></details>`;
      }).join('')}</div></section>

    <section class="bsec"><h3><span class="step">2</span>Communities to help first</h3>
      ${b.focus.length ? `<ul class="help">${help.shown.map(({ c }) => `<li><button class="linkbtn" data-go="c-${c.slug}">${esc(c.c.name)}</button>${scorePill(c.score)}<span>${esc(helpLine(c))}</span></li>`).join('')}</ul>${help.more}` : '<div class="okbox">No community needs extra help right now.</div>'}</section>

    <section class="bsec"><h3><span class="step">3</span>Corrective action plans</h3>
      <p class="big2"><b>${b.capClosed} of ${b.capKitchens}</b> kitchens have closed their plan.${follow.shown.length ? ' Still waiting on:' : ''}</p>
      ${follow.shown.length ? `<ul class="help">${follow.shown.map(({ a, t }) => `<li><button class="linkbtn" data-go="c-${a.slug}">${esc(kitchenName(a))}</button><span class="chip t-bad">${t}</span><span>Audited ${fmtDate(a.date)}</span></li>`).join('')}</ul>${follow.more}` : ''}</section>

    <section class="bsec value"><h3><span class="step">4</span>What the program has delivered</h3>
      <div class="vals">
        <div><b>${b.crit}</b><span>critical risks found. ${b.critClosed} now closed.</span></div>
        <div><b>${b.actions}</b><span>corrective actions written by community teams.</span></div>
        <div><b>${b.photos}</b><span>photos documenting ${m.audits.length} kitchen audits.</span></div>
      </div>
      ${fold('why', 'Why this matters', `<p>The audits turn food safety from a feeling into evidence. We know which habits put residents at risk, where they happen, and whether each community has fixed them. Every kitchen is scored on the same ${allStandards().length} standards, so results compare fairly across communities and rounds.</p>${cur ? `<p><b>Goals for ${esc(cur.name)}:</b> every community audited by ${fmtDate(cur.end)}, every plan submitted within ${m.settings.capDueDays} days, and the top 5 issues fixed everywhere using the <button class="linkbtn" data-go="playbook">readiness playbook</button> and monthly <button class="linkbtn" data-go="self">self-audits</button>.</p>` : ''}`)}</section>
  </div>`;
}

export function briefingText(m: Model, v: ViewState): string {
  const b = compute(m, v);
  const cur = currentRound(m.settings.rounds, m.today);
  return [`EcoSure food safety briefing: ${b.A[0]?.round ?? ''} round (${fmtDate(b.start, true)} to ${fmtDate(b.end)})`, '',
    `${b.A.length} kitchens across ${b.comms} communities were audited. The average score was ${pct(b.s)}. ${b.good} kitchens scored 85 or better, ${b.warn} scored 70 to 84, and ${b.bad} scored below 70. The top 5 issues make up ${Math.round(b.topShare * 100)}% of all points lost.`, '',
    'Top 5 things to fix:', ...b.top.map((p, i) => `${i + 1}. ${plainTitle(p.short)}: found in ${p.kitchens} of ${b.A.length} kitchens. ${PLAIN[p.short]?.why ?? ''}`), '',
    'Communities to help first:', ...b.focus.slice(0, 5).map(({ c }) => `- ${c.c.name}: ${helpLine(c)}`), '',
    `Follow-through: ${b.capClosed} of ${b.capKitchens} kitchens have closed their corrective action plan.`,
    ...(b.late.length ? [`Waiting on a plan: ${list(b.late.map(kitchenName))}.`] : []),
    ...(b.pastDue.length ? [`Items past due: ${list(b.pastDue.map(kitchenName))}.`] : []), '',
    `What the program has delivered: ${b.crit} critical food safety risks found (${b.critClosed} with a closed corrective action), ${b.actions} corrective actions written by community teams, and ${m.audits.length} kitchen audits on one yardstick backed by ${b.photos} photos.`,
    ...(cur ? ['', `Goals for ${cur.name}: every community audited by ${fmtDate(cur.end)}, every CAP within ${m.settings.capDueDays} days, and the top 5 issues fixed everywhere.`] : [])].join('\n');
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
  if (items.length) out.push(c.capState === 'closed' ? `The corrective action plan is closed: ${withAction} of ${items.length} findings have a written action.` : c.capState === 'late' ? 'The corrective action plan is late. Ask the team to submit it in EcoSure this week.' : c.capState === 'overdue' ? `The corrective action plan has items past their due date (${CAP_LABEL[c.capState].toLowerCase()}). ${withAction} of ${items.length} findings have a written action.` : c.capState === 'missing' ? `The corrective action plan is due ${fmtDate(A[0].capDue)}.` : `The corrective action plan is in progress: ${withAction} of ${items.length} findings have a written action.`);
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

