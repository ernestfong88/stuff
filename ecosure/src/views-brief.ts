/**
 * The briefing: one page in plain sentences that a regional or national leader can
 * read out loud. Every sentence is built from the data; nothing here is typed by hand.
 */
import { CAP_LABEL, capMissing, capMissingText, currentRound, needsCap, priorities, type Audit, type CommunityView, type Finding, type Model } from './model';
import { PLAIN, plainTitle } from './plain';
import { PLAYBOOK } from './playbook';
import { photoUrl } from './store';
import { avg, esc, fmtDate, pct, plural } from './util';
import { inRound, latestPerKitchen, scorePill, type ViewState } from './views';
import { scoreBand } from './model';
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
    missing: A.filter(capMissing).sort((x, y) => x.capDue.localeCompare(y.capDue)),
    crit: all.filter((f) => f.criticality === 'Critical').length, critClosed: all.filter((f) => f.criticality === 'Critical' && f.capItem && f.audit.capState === 'closed').length,
    actions: all.filter((f) => f.capItem).length, photos: all.reduce((x, f) => x + f.photos.length, 0),
    prev: prevName && prevName !== cur ? { name: prevName, s: avg(latestPerKitchen(m.audits.filter((a) => a.round === prevName)).map((a) => a.score)) } : null,
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

function bottomLine(b: Brief): [string, string][] {
  const t1 = b.top[0];
  const out: [string, string][] = [[`${b.A.length} kitchens audited, average score ${pct(b.s)}.`, `${b.good} are strong (85 or better) and ${b.bad} are below 70${b.prev?.s != null ? `; the average is ${b.s! >= b.prev.s ? 'up' : 'down'} from ${pct(b.prev.s)} last round` : ''}.`]];
  if (t1) out.push([`Five issues cause ${Math.round(b.topShare * 100)}% of lost points.`, `The biggest is ${lower(plainTitle(t1.short))}, found in ${t1.kitchens} of ${b.A.length} kitchens.`]);
  out.push([b.missing.length ? `${plural(b.missing.length, 'kitchen has', 'kitchens have')} no corrective action plan on file${b.late.length ? `, ${b.late.length} of them late` : ''}.` : 'Every cited kitchen has a corrective action plan on file.', `${b.capClosed} of ${b.capKitchens} plans are closed.`]);
  return out;
}

const CONTEXT = 'EcoSure is the independent food safety audit of every Kisco kitchen, scored out of 100: 85 or better is strong, and below 70 needs focus. This summary uses the latest audit of each kitchen.';

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

/** A few words on why a community is on the list, for compact rows. */
function shortWhy(c: CommunityView): string {
  const parts: string[] = [];
  if (c.critLatest) parts.push(`${c.critLatest} critical`);
  if (c.repeats) parts.push(plural(c.repeats, 'repeat'));
  parts.push(c.capState === 'closed' ? 'CAP closed' : c.capState === 'late' ? 'CAP missing, late' : c.capState === 'overdue' ? 'CAP items past due' : c.capState === 'missing' ? 'CAP missing' : c.capState === 'open' ? 'CAP in progress' : 'no findings');
  return parts.join(' · ');
}

function nextSteps(b: Brief): string[] {
  const steps: string[] = [];
  if (b.focus.length) steps.push(`Visit or call the ${Math.min(5, b.focus.length)} communities to help first, starting with ${b.focus[0].c.c.name}.`);
  if (b.missing.length || b.pastDue.length) steps.push([b.missing.length ? `Get the ${plural(b.missing.length, 'missing CAP')} submitted in EcoSure${b.late.length ? `, starting with the ${b.late.length} already late` : ''}` : '', b.pastDue.length ? `${b.missing.length ? 'and follow' : 'Follow'} up on ${plural(b.pastDue.length, 'plan')} with items past due` : ''].filter(Boolean).join(' ') + '.');
  const t = b.top[0];
  if (t) steps.push(`Make "${plainTitle(t.short).toLowerCase()}" a portfolio focus${PLAYBOOK[t.short] ? `: ${lower(PLAYBOOK[t.short].have[0])}` : ''}.`);
  return steps.slice(0, 3);
}

export function briefing(m: Model, v: ViewState): string {
  const b = compute(m, v);
  const cur = currentRound(m.settings.rounds, m.today);
  if (!b.A.length) return '<div class="empty">No audits yet. Add EcoSure reports on the Import files page.</div>';
  const roundName = b.A[0].round;
  const help = top('brief-help', b.focus, 5, 'communities');
  const follow = top('brief-follow', [...b.missing.map((a) => ({ a, t: capMissingText(a, m.today) })), ...b.pastDue.map((a) => ({ a, t: 'CAP items past due' }))], 5, 'kitchens');
  const kpi = (v: string, l: string, sub: string, tone = '') => `<div class="xkpi ${tone}"><b>${v}</b><span>${l}</span><small>${sub}</small></div>`;
  const row = (key: string, sumHtml: string, body: string) => `<details class="xrow" data-fold="${key}"${OPEN.has('fold:' + key) ? ' open' : ''}><summary>${sumHtml}<span class="chev" aria-hidden="true"></span></summary><div class="xbody">${body}</div></details>`;
  const card = (title: string, sowhat: string, go: string, goLabel: string, body: string, cls = '') => `<section class="xcard ${cls}"><header><div><h3>${title}</h3><p>${sowhat}</p></div><button class="linkbtn" data-go="${go}">${goLabel}</button></header>${body}</section>`;

  return `<div class="exec">
    <div class="pagehead"><div><p class="crumb">Executive summary · ${esc(roundName)} round · ${fmtDate(b.start, true)} to ${fmtDate(b.end)}</p><h2 class="page">Food safety briefing</h2></div>
      <div class="pageacts"><button class="btn ghost sm" data-act="share">Copy link</button><button class="btn sm" data-act="copy-summary">Copy as email</button></div></div>

    <p class="context">${esc(CONTEXT)}</p>
    <section class="bottomline"><span class="lbl">The bottom line</span><ol>
      ${bottomLine(b).map(([h, t]) => `<li><b>${esc(h)}</b> ${esc(t)}</li>`).join('')}
    </ol></section>

    <div class="xkpis">
      ${kpi(pct(b.s), 'Average score', `${b.good} kitchens at 85 or better`, scoreBand(b.s))}
      ${kpi(String(b.bad), 'Kitchens below 70', `of ${b.A.length} audited`, b.bad ? 'bad' : 'good')}
      ${kpi(String(b.crit), 'Critical findings', `${b.critClosed} closed so far`, b.crit ? 'bad' : 'good')}
      ${kpi(String(b.missing.length), 'CAPs missing', `${b.late.length} late · ${b.capClosed} of ${b.capKitchens} closed`, b.missing.length ? 'bad' : 'good')}
    </div>

    ${card('What to fix', `Ranked by points lost; together ${Math.round(b.topShare * 100)}% of the total. Select one for why it matters and the fix.`, 'priorities', 'All priorities', `<div class="xlist">${b.top.map((p, i) => {
      const ph = bestPhoto(p.findings);
      return row('issue-' + i, `<span class="rank">${i + 1}</span>${ph ? `<img src="${esc(photoUrl(ph.f.photos[0]))}" alt="" loading="lazy">` : '<span class="noimg"></span>'}<span class="xt"><b>${esc(plainTitle(p.short))}</b><span class="meter" aria-hidden="true"><span style="width:${(p.kitchens / b.A.length) * 100}%"></span></span></span><span class="xn"><b>${p.kitchens}</b> of ${b.A.length} kitchens</span>`,
        `<p>${esc(PLAIN[p.short]?.why ?? '')}</p>${PLAYBOOK[p.short] ? `<p><b>The fix:</b> ${esc(PLAYBOOK[p.short].have[0])}.</p>` : ''}
        ${ph ? `<div class="thumbs">${p.findings.filter((f) => f.photos.length).slice(0, 5).map((f) => `<button data-photo="${esc(f.key)}" data-n="0" aria-label="Open photo from ${esc(f.audit.community)}"><img loading="lazy" src="${esc(photoUrl(f.photos[0]))}" alt=""></button>`).join('')}</div>` : ''}
        <button class="linkbtn" data-act="std-photos:${esc(p.short)}">See all ${p.findings.length} findings</button>`);
    }).join('')}</div>`, 'wide')}

    <div class="xgrid">
      ${card('Who needs help', 'Score below 70, four or more critical findings, or three or more repeats.', 'communities', 'All communities', b.focus.length ? `<div class="xlist">${help.shown.map(({ c }) => row('help-' + c.slug, `${scorePill(c.score)}<span class="xt"><b>${esc(c.c.name)}</b><span class="xs">${esc(shortWhy(c))}</span></span>`,
        `<p>${esc(helpLine(c))}</p><button class="btn sm" data-go="c-${c.slug}">Open ${esc(c.c.name)}</button>`)).join('')}</div>${help.more}` : '<div class="okbox">No community needs extra help right now.</div>')}
      ${card('CAP follow-through', `${b.missing.length ? `<b class="miss">${plural(b.missing.length, 'kitchen has', 'kitchens have')} no CAP on file.</b> ` : ''}CAPs are due ${m.settings.capDueDays} days after the audit; ${b.capClosed} of ${b.capKitchens} are closed.`, 'actions', 'Action list', follow.shown.length ? `<div class="xlist">${follow.shown.map(({ a, t }) => row('cap-' + a.key, `<span class="xt"><b>${esc(kitchenName(a))}</b><span class="xs">Audited ${fmtDate(a.date)} · ${plural(a.items.length, 'finding')}${a.crit ? `, ${a.crit} critical` : ''}</span></span><span class="chip t-bad plain capmiss">${esc(t)}</span>`,
        `<p>${a.cap ? `EcoSure shows the plan as ${esc(a.cap.status)}${a.pastDueItems ? `, with ${plural(a.pastDueItems, 'item')} past the due date` : ''}.` : `No plan in EcoSure yet. It was due ${fmtDate(a.capDue)}.`} ${plural(a.items.length, 'finding')}${a.crit ? `, ${a.crit} critical` : ''}.</p><button class="btn sm" data-go="c-${a.slug}">Open ${esc(a.community)}</button>`)).join('')}</div>${follow.more}` : '<div class="okbox">Every cited kitchen has a closed plan.</div>')}
    </div>

    ${card('By region', 'Lowest average score first. Select a region to see its communities.', 'communities', 'All communities', `<div class="xlist">${b.regions.map((r) => row('region-' + slugify(r.name), `${scorePill(r.s)}<span class="xt"><b>${esc(r.name)}</b><span class="xs">${plural(r.comms.length, 'community', 'communities')} · ${r.bad} below 70 · ${r.capMissing ? `<span class="miss">${r.capMissing} CAP missing</span>` : 'no CAP missing'}</span></span>`,
      `<ul class="rlist">${r.comms.map((c) => `<li><button class="linkbtn" data-go="c-${c.slug}">${esc(c.c.name)}</button>${scorePill(c.score)}<span class="xs">${c.latest.length ? esc(shortWhy(c)) : esc(c.c.note || 'Not audited yet')}</span></li>`).join('')}</ul>`)).join('')}</div>`, 'wide')}

    ${card('What the program has delivered', 'Results of the audit program so far, for residents and for the company.', 'trends', 'Trends', `<div class="vals">
        <div><b>${b.critClosed}<small> of ${b.crit}</small></b><span><strong>Critical risks closed.</strong> Each was a real hazard to residents, such as food held at unsafe temperatures or sanitizer that was not working, now fixed and documented in EcoSure.</span></div>
        ${b.prev?.s != null && b.s != null
          ? `<div><b>${b.s >= b.prev.s ? '+' : ''}${Math.round(b.s - b.prev.s)}<small> points</small></b><span><strong>Average score since ${esc(b.prev.name)}.</strong> ${b.improved} of ${b.reaudited} re-audited kitchens improved.</span></div>`
          : `<div><b>${pct(b.s)}</b><span><strong>Baseline average score.</strong> ${cur ? `${esc(cur.name)} audits` : 'The next round'} will show how much each kitchen improves.</span></div>`}
        <div><b>${b.actions}</b><span><strong>Corrective actions</strong> written by community teams, each tied to a specific finding and photo.</span></div>
      </div>`, 'wide')}

    ${card('Next steps', 'What we are asking regional and community teams to do this month.', 'playbook', 'Readiness playbook', `<ol class="steps">${nextSteps(b).map((s) => `<li>${esc(s)}</li>`).join('')}</ol>`, 'wide')}
  </div>`;
}

const slugify = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, '-');

export function briefingText(m: Model, v: ViewState, link = ''): string {
  const b = compute(m, v);
  const cur = currentRound(m.settings.rounds, m.today);
  const round = b.A[0]?.round ?? '';
  return [`Subject: EcoSure food safety summary, ${round} round`, '',
    `This is a summary of our EcoSure food safety audits from ${fmtDate(b.start, true)} to ${fmtDate(b.end)}. ${CONTEXT}`, '',
    'THE BOTTOM LINE', ...bottomLine(b).map(([h, t]) => `- ${h} ${t}`), '',
    'KEY NUMBERS', `- Average score: ${pct(b.s)}`, `- Kitchens below 70: ${b.bad} of ${b.A.length}`, `- Critical findings: ${b.crit} (${b.critClosed} closed)`, `- CAPs missing: ${b.missing.length} (${b.late.length} late); ${b.capClosed} of ${b.capKitchens} closed`, '',
    'WHAT TO FIX (top 5 by points lost)', ...b.top.map((p, i) => `${i + 1}. ${plainTitle(p.short)}: ${p.kitchens} of ${b.A.length} kitchens. ${PLAIN[p.short]?.why ?? ''}`), '',
    'WHO NEEDS HELP', ...b.focus.slice(0, 5).map(({ c }) => `- ${c.c.name}: ${helpLine(c)}`), ...(b.focus.length > 5 ? [`- and ${b.focus.length - 5} more in the full briefing`] : []), '',
    'FOLLOW-THROUGH', `- ${b.capClosed} of ${b.capKitchens} corrective action plans are closed.`,
    ...(b.missing.length ? [`- CAP missing (${b.missing.length}): ${list(b.missing.map((a) => `${kitchenName(a)} (${capMissingText(a, m.today).replace('CAP missing · ', '')})`))}.`] : []),
    ...(b.pastDue.length ? [`- Items past due: ${list(b.pastDue.map(kitchenName))}.`] : []), '',
    'BY REGION', ...b.regions.map((r) => `- ${r.name}: average ${pct(r.s)}, ${r.bad} below 70, ${r.capMissing} CAP missing`), '',
    'WHAT THE PROGRAM HAS DELIVERED', `- ${b.critClosed} of ${b.crit} critical risks to residents found and closed.`,
    b.prev?.s != null && b.s != null ? `- Average score ${b.s >= b.prev.s ? 'up' : 'down'} ${Math.abs(Math.round(b.s - b.prev.s))} points since ${b.prev.name}; ${b.improved} of ${b.reaudited} re-audited kitchens improved.` : `- Baseline average score of ${pct(b.s)} set; ${cur ? cur.name : 'next round'} audits will show the change.`,
    `- ${b.actions} corrective actions written by community teams.`, '',
    'NEXT STEPS', ...nextSteps(b).map((x, i) => `${i + 1}. ${x}`),
    ...(link ? ['', `Full briefing with photos: ${link}`] : [])].join('\n');
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

