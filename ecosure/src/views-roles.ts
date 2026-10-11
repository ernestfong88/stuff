/** Role homes, priorities, the readiness playbook and self-audits. */
import { THEMES, allStandards, themeOf, type Standard } from './catalog';
import { CRIT_COLOR } from './charts';
import { AUDIT_LABEL, AUDIT_TONE, CAP_LABEL, CAP_TONE, needsCap, priorities, scoreBand, type Audit, type CommunityView, type Model, type Priority } from './model';
import { PLAYBOOK } from './playbook';
import type { Crit, SelfAudit, SelfResult } from './types';
import { avg, countBy, esc, fmtDate, pct, plural, slug } from './util';
import { auditWhy, inRound, latestPerKitchen, roundChips, scorePill, type ViewState } from './views';

export type Role = 'leadership' | 'regional' | 'community';
export const ROLE_LABEL: Record<Role, string> = { leadership: 'Leadership', regional: 'Regional', community: 'Community team' };

const chip = (tone: string, text: string, title = '') => `<span class="chip t-${tone}"${title ? ` title="${esc(title)}"` : ''}>${esc(text)}</span>`;
const critChip = (c: Crit) => `<span class="chip c-${c}">${c}</span>`;
const shortName = (m: Model, name: string) => m.settings.roster.find((c) => c.name === name)?.short || name;
const slugOf = (m: Model, name: string) => m.communities.find((c) => c.c.name === name)?.slug ?? slug(name);
const shareBtn = (label = 'Copy link to this page') => `<button class="btn ghost sm" data-act="share">${label}</button>`;
const head = (crumb: string, title: string, lede: string, extra = '') => `<div class="pagehead"><div><p class="crumb">${esc(crumb)}</p><h2 class="page">${esc(title)}</h2><p class="lede">${lede}</p></div><div class="pageacts">${extra}</div></div>`;
export const readyPill = (r: number | null) => `<span class="score s-${r == null ? 'none' : r >= 90 ? 'good' : r >= 75 ? 'warn' : 'bad'}">${r == null ? 'None' : Math.round(r) + '%'}</span>`;
const SELF_LABEL = { none: 'No self-audit yet', due: 'Self-audit due', current: 'Self-audit current' } as const;
const SELF_TONE = { none: 'none', due: 'warn', current: 'good' } as const;
export const selfChip = (c: CommunityView) => chip(SELF_TONE[c.selfState], SELF_LABEL[c.selfState], c.self ? `Last on ${fmtDate(c.self.date)} by ${c.self.by}` : '');

/* ---------- welcome ---------- */
export function welcome(m: Model): string {
  const kitchens = latestPerKitchen(m.audits);
  return `<div class="welcome"><p class="crumb">Kisco Senior Living · Culinary food safety</p>
    <h2 class="page">EcoSure Audit Review</h2>
    <p class="lede">EcoSure food safety audits for ${plural(m.communities.filter((c) => c.c.active).length, 'community', 'communities')} and ${plural(kitchens.length, 'kitchen')} in one place: what to fix first, who needs an audit or a corrective action plan, and what every kitchen needs in place to pass. Choose the view that fits your job. You can switch any time from the menu.</p>
    <div class="roles">
      <button class="role" data-role="leadership"><b>Leadership</b><span>Portfolio priorities, communities of focus, CAP follow-up and trends.</span><span class="go">Open leadership view</span></button>
      <button class="role" data-role="regional"><b>Regional</b><span>Your communities ranked for visits, with each one's top fixes and status.</span><span class="go">Open regional view</span></button>
      <button class="role" data-role="community"><b>Community team</b><span>Your kitchen's fix list, CAP status, and the self-audit checklist.</span><span class="go">Open community view</span></button>
    </div></div>`;
}

/* ---------- focus cards ---------- */
function focusCard(m: Model, p: Priority, n: number, total: number): string {
  const play = PLAYBOOK[p.short];
  const list = p.communities.slice(0, 8).map((c) => `<button class="tag" data-go="c-${slugOf(m, c)}">${esc(shortName(m, c))}</button>`).join('') + (p.communities.length > 8 ? `<span class="note">+${p.communities.length - 8} more</span>` : '');
  return `<article class="focus"><div class="fnum" aria-hidden="true">${n}</div><div class="fbody">
    <div class="ftop"><h4>${esc(p.short)}</h4>${critChip(p.crit)}<span class="note">${esc(p.theme)}</span></div>
    <p class="fimpact"><b>+${p.impact.toFixed(1)} points</b> on the average kitchen score if fixed everywhere. Cited in ${p.kitchens} of ${total} kitchens${p.repeats ? `, ${p.repeats} repeat` : ''}.</p>
    ${play ? `<p class="fgood"><span class="lbl">What good looks like</span> ${esc(play.have[0])}.</p>` : ''}
    <div class="tags">${list}</div>
    <div class="factions"><button class="btn sm" data-act="std:${esc(p.short)}">See the ${p.findings.length} findings</button><button class="btn ghost sm" data-go="playbook.${slug(p.short)}">Playbook</button></div>
  </div></article>`;
}

/** Communities that need leadership attention, with the reasons. */
export function communitiesOfFocus(m: Model): { c: CommunityView; why: string[] }[] {
  return m.communities.filter((c) => c.c.active).map((c) => {
    // Qualifying reasons: a low score, many critical findings, or findings that keep coming back.
    const why: string[] = [];
    if (c.score != null && c.score < 70) why.push(`Score ${Math.round(c.score)}`);
    if (c.critLatest >= 4) why.push(`${c.critLatest} critical findings`);
    if (c.repeats >= 3) why.push(`${c.repeats} repeat findings`);
    if (!why.length) return { c, why };
    // Context that adds urgency.
    if (c.critLatest >= 2 && c.critLatest < 4) why.push(`${c.critLatest} critical findings`);
    if (c.capState === 'late' || c.capState === 'overdue') why.push(CAP_LABEL[c.capState]);
    if (c.auditState === 'overdue') why.push(AUDIT_LABEL[c.auditState]);
    return { c, why };
  }).filter((x) => x.why.length).sort((a, b) => b.why.length - a.why.length || (a.c.score ?? 101) - (b.c.score ?? 101));
}

function themeHeat(m: Model, audits: Audit[], names: string[]): string {
  if (!names.length) return '<div class="empty">No audits yet.</div>';
  const items = audits.flatMap((a) => a.items);
  const max = Math.max(1, ...names.flatMap((c) => THEMES.map((t) => items.filter((i) => i.audit.community === c && themeOf(i.short) === t.t).reduce((s, i) => s + i.points, 0))));
  const cell = (c: string, t: string) => {
    const it = items.filter((i) => i.audit.community === c && themeOf(i.short) === t);
    const pts = it.reduce((s, i) => s + i.points, 0);
    if (!pts) return '<td class="hc" style="background:var(--hm0)"></td>';
    const k = pts / max, bg = k > 0.66 ? 'var(--hm3)' : k > 0.33 ? 'var(--hm2)' : 'var(--hm1)';
    return `<td class="hc" style="background:${bg};color:${k > 0.33 ? '#fff' : 'var(--ink)'}" title="${esc(c)}, ${esc(t)}: ${pts} points lost, ${it.length} findings" data-go="c-${slugOf(m, c)}">${pts}</td>`;
  };
  return `<div class="tablewrap"><table class="hm theme-hm"><thead><tr><th>Community</th>${THEMES.map((t) => `<th class="c" data-act="theme:${esc(t.t)}" style="cursor:pointer">${esc(t.t)}</th>`).join('')}<th class="num">Score</th></tr></thead><tbody>
    ${names.map((c) => `<tr><td class="lab"><button class="linkbtn" data-go="c-${slugOf(m, c)}">${esc(c)}</button></td>${THEMES.map((t) => cell(c, t.t)).join('')}<td class="num">${scorePill(avg(audits.filter((a) => a.community === c).map((a) => a.score)))}</td></tr>`).join('')}
    </tbody></table></div><div class="legend"><span>Points lost per theme in the latest audit of each kitchen.</span><span><i style="background:var(--hm1)"></i>Low</span><span><i style="background:var(--hm2)"></i>Medium</span><span><i style="background:var(--hm3)"></i>High</span></div>`;
}

/* ---------- leadership ---------- */
export function homeLeadership(m: Model, v: ViewState): string {
  const A = latestPerKitchen(inRound(m, v));
  const P = priorities(A);
  const scored = A.filter((a) => a.score != null);
  const focus = communitiesOfFocus(m);
  const capNeeded = A.filter((a) => a.items.length), closed = capNeeded.filter((a) => a.capState === 'closed').length;
  const active = m.communities.filter((c) => c.c.active);
  const selfCurrent = active.filter((c) => c.selfState === 'current').length;
  const top5 = P.slice(0, 5);
  const gain = top5.reduce((s, p) => s + p.impact, 0);
  const names = [...new Set(A.map((a) => a.community))].sort((a, b) => (avg(A.filter((x) => x.community === a).map((x) => x.score)) ?? 101) - (avg(A.filter((x) => x.community === b).map((x) => x.score)) ?? 101));
  return head('Leadership', 'Food safety at a glance', `Where the portfolio stands and the few things that would move it most. Based on the latest audit of each kitchen${v.round !== 'all' ? ` in ${esc(v.round)}` : ''}.`, `${shareBtn()}<button class="btn ghost sm" data-act="copy-summary">Copy summary for email</button>`) +
    roundChips(m, v) +
    `<div class="grid kpis">
      <div class="kpi ${scoreBand(avg(scored.map((a) => a.score)))}"><div class="v">${pct(avg(scored.map((a) => a.score)))}</div><div class="l">Average kitchen score</div></div>
      <button class="kpi ${focus.length ? 'bad' : 'good'}" data-act="scroll:focus-comms"><div class="v">${focus.length}</div><div class="l">Communities of focus</div></button>
      <button class="kpi ${A.some((a) => a.crit) ? 'bad' : ''}" data-go="findings" data-crit="Critical"><div class="v">${A.reduce((s, a) => s + a.crit, 0)}</div><div class="l">Critical findings</div></button>
      <button class="kpi ${closed === capNeeded.length ? 'good' : 'warn'}" data-go="actions" data-tab="caps"><div class="v">${closed}<small> of ${capNeeded.length}</small></div><div class="l">CAPs closed</div></button>
      <button class="kpi ${selfCurrent === active.length ? 'good' : 'warn'}" data-go="self"><div class="v">${selfCurrent}<small> of ${active.length}</small></div><div class="l">Self-audits current</div></button>
    </div>
    <section class="block"><div class="sechead"><h3>Top 5 focus areas</h3><p class="note">Fixing these five everywhere would add about <b>${gain.toFixed(1)} points</b> to the average kitchen score. Ranked by points lost across the portfolio.</p><button class="btn ghost sm" data-go="priorities">All priorities</button></div>
      <div class="focuslist">${top5.map((p, i) => focusCard(m, p, i + 1, A.length)).join('') || '<div class="empty">No findings yet.</div>'}</div></section>
    <section class="block" id="focus-comms"><div class="sechead"><h3>Communities of focus</h3><p class="note">A score below 70, four or more critical findings, or three or more repeat findings. Late CAPs for everyone else are on the action list.</p></div>
      ${focus.length ? `<div class="tablewrap"><table><thead><tr><th>Community</th><th class="num">Score</th><th>Why</th><th>CAP</th><th>Next step</th></tr></thead><tbody>${focus.map(({ c, why }) => `<tr class="rowlink" data-go="c-${c.slug}"><td><b>${esc(c.c.name)}</b><span class="sub">${esc(c.c.city)}</span></td><td class="num">${scorePill(c.score)}</td><td>${why.map((w) => `<span class="reason">${esc(w)}</span>`).join(' ')}</td><td>${chip(CAP_TONE[c.capState], CAP_LABEL[c.capState])}</td><td class="why">${esc(nextStep(c))}</td></tr>`).join('')}</tbody></table></div>` : '<div class="okbox">No community meets the focus criteria.</div>'}</section>
    <section class="block"><div class="sechead"><h3>Portfolio by theme</h3><p class="note">The whole picture in one grid: points lost in each area a visitor walks. Select a theme to see its findings.</p></div>${themeHeat(m, A, names)}</section>`;
}

function nextStep(c: CommunityView): string {
  if (c.capState === 'late') return 'Get the CAP submitted in EcoSure.';
  if (c.capState === 'overdue') return 'Follow up on CAP items past their due date.';
  if (c.score != null && c.score < 70) return 'Schedule a support visit and a self-audit.';
  if (c.repeats >= 2) return 'Review repeat findings with the culinary director.';
  if (c.auditState === 'overdue' || c.auditState === 'never') return 'Schedule the EcoSure audit.';
  return 'Review the critical findings on the next visit.';
}

export function summaryText(m: Model, v: ViewState): string {
  const A = latestPerKitchen(inRound(m, v));
  const P = priorities(A).slice(0, 5);
  const focus = communitiesOfFocus(m);
  const nc = needsCap(m);
  const s = avg(A.map((a) => a.score));
  return [`EcoSure food safety summary, ${fmtDate(m.today)}`, '',
    `Average kitchen score: ${pct(s)} across ${A.length} kitchens. ${A.reduce((x, a) => x + a.crit, 0)} critical findings.`, '',
    'Top focus areas:', ...P.map((p, i) => `${i + 1}. ${p.short} (${p.crit}): cited in ${p.kitchens} kitchens, worth ${p.impact.toFixed(1)} points on the average score`), '',
    `Communities of focus (${focus.length}):`, ...focus.map(({ c, why }) => `- ${c.c.name}: ${why.join(', ')}`), '',
    `CAPs needing follow-up (${nc.length}):`, ...nc.map((a) => `- ${a.community}${a.kitchen !== 'Main Kitchen' ? ', ' + a.kitchen : ''}: ${CAP_LABEL[a.capState]}`)].join('\n');
}

/* ---------- regional ---------- */
export function homeRegional(m: Model, mine: string[]): string {
  const all = m.communities.filter((c) => c.c.active);
  const regions = [...new Set(all.map((c) => c.c.region).filter(Boolean))] as string[];
  const list = (mine.length ? all.filter((c) => mine.includes(c.slug)) : all);
  const rank = (c: CommunityView) => (c.capState === 'late' || c.capState === 'overdue' ? 0 : 10) + (c.score == null ? 5 : c.score / 20) - c.critLatest;
  const rows = [...list].sort((a, b) => rank(a) - rank(b));
  return head('Regional', mine.length ? 'Your communities' : 'Visit planner', `Communities ranked by need: late CAPs and low scores first. Each card shows the three fixes worth the most points. ${mine.length ? '' : 'Pick your communities below to narrow this list; the choice is saved in this browser.'}`, shareBtn()) +
    `<details class="panel picker"${mine.length ? '' : ' open'}><summary><b>Choose your communities</b> <span class="note">${mine.length ? `${mine.length} selected` : 'showing all'}</span></summary>
      ${regions.length ? `<div class="toolbar" style="margin-top:10px"><span class="lbl">Region</span>${regions.map((r) => `<button class="fbtn" data-act="mine-region:${esc(r)}">${esc(r)}</button>`).join('')}</div>` : ''}
      <div class="checks">${all.map((c) => `<label><input type="checkbox" data-mine="${c.slug}"${mine.includes(c.slug) ? ' checked' : ''}> ${esc(c.c.name)}</label>`).join('')}</div>
      <div class="toolbar" style="margin:10px 0 0">${mine.length ? '<button class="btn quiet sm" data-act="mine-clear">Show all communities</button>' : ''}</div></details>
    <section class="block grid cards">${rows.map((c) => visitCard(m, c)).join('')}</section>`;
}

function visitCard(m: Model, c: CommunityView): string {
  const fixes = c.latest.flatMap((a) => a.items).sort((a, b) => b.points - a.points || Number(b.repeat) - Number(a.repeat)).filter((f, i, arr) => arr.findIndex((x) => x.short === f.short) === i).slice(0, 3);
  return `<article class="vcard"><div class="vhead"><button class="linkbtn" data-go="c-${c.slug}"><b>${esc(c.c.name)}</b></button>${scorePill(c.score)}</div>
    <div class="vmeta">${c.lastDate ? `Audited ${fmtDate(c.lastDate)}` : 'No audit on file'} · ${esc(c.c.city)}</div>
    <div class="chips">${chip(AUDIT_TONE[c.auditState], AUDIT_LABEL[c.auditState])}${c.latest.some((a) => a.items.length) ? chip(CAP_TONE[c.capState], CAP_LABEL[c.capState]) : ''}${selfChip(c)}</div>
    ${fixes.length ? `<ol class="fixes">${fixes.map((f) => `<li><span>${esc(f.short)}${f.repeat ? ' <span class="repeat">REPEAT</span>' : ''}</span>${critChip(f.criticality)}</li>`).join('')}</ol>` : `<p class="note">${esc(auditWhy(c, m))}</p>`}
    <div class="factions"><button class="btn sm" data-go="c-${c.slug}">Visit brief</button><button class="btn ghost sm" data-go="self-${c.slug}">Self-audit</button></div></article>`;
}

/* ---------- community team ---------- */
export function homeCommunity(m: Model, mySlug: string): string {
  const opts = m.communities.filter((c) => c.c.active || c.audits.length);
  return `<div class="panel mypick"><label class="field"><span class="lbl">Your community</span><select id="my-community">${mySlug ? '' : '<option value="">Choose your community</option>'}${opts.map((c) => `<option value="${c.slug}"${c.slug === mySlug ? ' selected' : ''}>${esc(c.c.name)}</option>`).join('')}</select></label><span class="note">Saved in this browser. The page below is your kitchen's report card.</span></div>`;
}

/** The "fix first" list for one community's latest audits. */
export function fixFirst(A: Audit[]): string {
  const items = A.flatMap((a) => a.items).sort((a, b) => (b.capItem ? 0 : 1) - (a.capItem ? 0 : 1) || b.points - a.points || Number(b.repeat) - Number(a.repeat));
  if (!items.length) return '';
  const multi = new Set(A.map((a) => a.kitchen)).size > 1;
  const closed = (a: Audit) => a.capState === 'closed';
  return `<section class="block"><div class="sechead"><h3>Fix first</h3><p class="note">Every finding from this audit, ordered by what still needs a corrective action and how many points it cost.</p></div>
    <div class="tablewrap"><table class="fixtable"><thead><tr><th>Standard</th>${multi ? '<th>Kitchen</th>' : ''}<th class="num">Points</th><th>Corrective action</th><th>What to have in place</th></tr></thead><tbody>
    ${items.map((f) => `<tr><td><b>${esc(f.short)}</b> ${critChip(f.criticality)}${f.repeat ? ' <span class="repeat" title="Also cited at the previous audit">REPEAT</span>' : ''}${f.comment ? `<span class="sub">${esc(f.comment.length > 140 ? f.comment.slice(0, 137) + '...' : f.comment)}</span>` : ''}</td>${multi ? `<td>${esc(f.audit.kitchen)}</td>` : ''}<td class="num">-${f.points}</td>
      <td>${f.capItem ? `${chip(closed(f.audit) ? 'good' : 'warn', closed(f.audit) ? 'Closed' : 'Action on file')}${f.capItem.action ? `<span class="sub">${esc(f.capItem.action.length > 120 ? f.capItem.action.slice(0, 117) + '...' : f.capItem.action)}</span>` : ''}` : chip('bad', 'Needs action')}</td>
      <td class="why">${esc(PLAYBOOK[f.short]?.have.join('. ') ?? '')}${PLAYBOOK[f.short] ? ` <button class="linkbtn" data-go="playbook.${slug(f.short)}">More</button>` : ''}</td></tr>`).join('')}
    </tbody></table></div></section>`;
}

/* ---------- priorities ---------- */
export function prioritiesView(m: Model, v: ViewState): string {
  const A = latestPerKitchen(inRound(m, v));
  const P = priorities(A);
  const max = Math.max(1, ...P.map((p) => p.points));
  return head('Priorities', 'What to fix first', `Every cited standard ranked by points lost across the latest audit of each kitchen. "Score gain" is how much the average kitchen score would rise if the standard were fixed everywhere.`, shareBtn()) +
    roundChips(m, v) +
    `<div class="tablewrap"><table><thead><tr><th class="num">#</th><th>Standard</th><th>Theme</th><th class="num">Score gain</th><th style="min-width:160px">Points lost</th><th class="num">Kitchens</th><th class="num">Critical</th><th class="num">Repeats</th><th></th></tr></thead><tbody>
    ${P.map((p, i) => `<tr><td class="num">${i + 1}</td><td><b>${esc(p.short)}</b> ${critChip(p.crit)}</td><td>${esc(p.theme)}</td><td class="num"><b>+${p.impact.toFixed(1)}</b></td>
      <td><span class="minibar"><span style="width:${(p.points / max) * 100}%;background:${CRIT_COLOR[p.crit]}"></span></span> <span class="note">${p.points}</span></td>
      <td class="num">${p.kitchens}</td><td class="num">${p.critical || ''}</td><td class="num">${p.repeats || ''}</td>
      <td><button class="linkbtn" data-act="std:${esc(p.short)}">Findings</button> · <button class="linkbtn" data-go="playbook.${slug(p.short)}">Playbook</button></td></tr>`).join('')}
    </tbody></table></div>`;
}

/* ---------- playbook ---------- */
export function playbookView(m: Model, focus: string | null, filter: { theme: string; q: string; cited: boolean }): string {
  const A = latestPerKitchen(m.audits);
  const P = new Map(priorities(A).map((p) => [p.short, p]));
  const allF = m.findings;
  const comms = new Set(A.map((a) => a.community)).size;
  const q = filter.q.toLowerCase();
  const list = (t: string) => allStandards().filter((s) => themeOf(s.short) === t)
    .filter((s) => (!filter.cited || P.has(s.short)) && (!q || (s.short + ' ' + s.q + ' ' + (PLAYBOOK[s.short]?.have.join(' ') ?? '')).toLowerCase().includes(q)))
    .sort((a, b) => (P.get(b.short)?.points ?? 0) - (P.get(a.short)?.points ?? 0));
  const misses = (s: Standard) => [...countBy(allF.filter((f) => f.short === s.short).flatMap((f) => f.findings.map((x) => x.replace(/\s*\(include.*$/i, '').trim())).filter(Boolean), (x) => x)].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const card = (s: Standard) => {
    const p = P.get(s.short), play = PLAYBOOK[s.short];
    const ms = misses(s);
    return `<article class="std${focus === slug(s.short) ? ' hl' : ''}" id="p-${slug(s.short)}"><div class="stop"><h4>${esc(s.short)}</h4>${critChip((s.crit || 'Unrated') as Crit)}<span class="note">${s.cid ? esc(s.cid) + ' · ' : ''}${(({ Critical: 5, Major: 3, Minor: 1 }) as Record<string, number>)[s.crit] ?? 0} points</span>
      <span class="grow"></span>${p ? `<span class="cited">Cited at ${p.communities.length} of ${comms} communities</span>` : '<span class="cited ok">Not cited in the latest audits</span>'}</div>
      <p class="q">EcoSure checks: ${esc(s.q)}</p>
      ${play ? `<div class="pgrid"><div><span class="lbl">Have in place</span><ul>${play.have.map((h) => `<li>${esc(h)}</li>`).join('')}</ul></div><div><span class="lbl">30-second check</span><p>${esc(play.check)}</p></div>${ms.length ? `<div><span class="lbl">Most common misses</span><ul>${ms.map(([x, n]) => `<li>${esc(x)}${n > 1 ? ` <span class="note">(${n})</span>` : ''}</li>`).join('')}</ul></div>` : ''}</div>` : ''}
      ${p ? `<div class="factions"><button class="btn ghost sm" data-act="std:${esc(s.short)}">See ${plural(p.findings.length, 'finding')}</button></div>` : ''}</article>`;
  };
  const themes = filter.theme === 'all' ? THEMES : THEMES.filter((t) => t.t === filter.theme);
  return head('Readiness playbook', 'What every kitchen needs in place', `The ${allStandards().length} EcoSure standards cited at Kisco so far, grouped the way you walk a kitchen. Each one lists what to have in place, a quick check, and the misses EcoSure found most often. Use it to prepare for an audit or to run a self-audit.`, `${shareBtn()}<button class="btn sm" data-go="self">Start a self-audit</button>`) +
    `<div class="toolbar"><span class="lbl">Theme</span>${['all', ...THEMES.map((t) => t.t)].map((t) => `<button class="fbtn" data-pbtheme="${esc(t)}" aria-pressed="${filter.theme === t}">${t === 'all' ? 'All' : esc(t)}</button>`).join('')}</div>
    <div class="toolbar"><input type="search" id="pb-q" placeholder="Search the playbook" value="${esc(filter.q)}" aria-label="Search the playbook"><button class="fbtn" data-act="pb-cited" aria-pressed="${filter.cited}">Only standards cited in the latest audits</button></div>
    ${themes.map((t) => { const ss = list(t.t); return ss.length ? `<section class="block"><div class="sechead"><h3>${esc(t.t)}</h3><p class="note">${esc(t.look)}</p></div><div class="stds">${ss.map(card).join('')}</div></section>` : ''; }).join('') || '<div class="empty">No standards match.</div>'}`;
}

/* ---------- self-audits ---------- */
export function selfAuditsView(m: Model): string {
  const comms = m.communities.filter((c) => c.c.active);
  const done = comms.filter((c) => c.selfState === 'current').length;
  const days = m.settings.selfAuditDays ?? 30;
  return head('Self-audits', 'Self-audit tracker', `Each community walks its kitchen against the readiness checklist every ${days} days. Readiness is the share of applicable checks that passed, weighted like EcoSure points. ${done} of ${comms.length} communities are current.`, shareBtn()) +
    `<div class="tablewrap"><table><thead><tr><th>Community</th><th>Last self-audit</th><th>By</th><th class="num">Readiness</th><th class="num">Failed checks</th><th>Status</th><th class="num">EcoSure score</th><th></th></tr></thead><tbody>
    ${[...comms].sort((a, b) => (a.self?.date ?? '').localeCompare(b.self?.date ?? '') || a.c.name.localeCompare(b.c.name)).map((c) => `<tr><td><button class="linkbtn" data-go="c-${c.slug}">${esc(c.c.name)}</button></td><td>${c.self ? fmtDate(c.self.date) : '<span class="note">Never</span>'}</td><td>${esc(c.self?.by ?? '')}</td><td class="num">${readyPill(c.readiness)}</td><td class="num">${c.self ? Object.values(c.self.results).filter((r) => r.r === 'fail').length : ''}</td><td>${selfChip(c)}</td><td class="num">${scorePill(c.score)}</td><td><button class="btn ghost sm" data-go="self-${c.slug}">${c.self ? 'New self-audit' : 'Start'}</button></td></tr>`).join('')}
    </tbody></table></div>`;
}

export interface SelfDraft { kitchen: string; date: string; by: string; results: Record<string, { r: SelfResult; note?: string }> }

export function selfAuditForm(m: Model, v: ViewState, slugKey: string, d: SelfDraft): string {
  const c = m.bySlug.get(slugKey);
  if (!c) return head('Self-audit', 'Community not found', '<button class="linkbtn" data-go="self">Back to self-audits</button>');
  const cited = new Map(c.latest.flatMap((a) => a.items.map((f) => [f.short, a] as const)));
  const stds = allStandards();
  const answered = stds.filter((s) => d.results[s.short]).length;
  const kitchens = c.c.kitchens.length ? c.c.kitchens : ['Main Kitchen'];
  const prev = c.self;
  const btn = (s: Standard, r: SelfResult, label: string) => `<button type="button" class="seg ${r}" data-self="${esc(s.short)}" data-r="${r}" aria-pressed="${d.results[s.short]?.r === r}">${label}</button>`;
  return head(`Self-audit · ${c.c.name}`, 'Kitchen self-audit', `Walk the kitchen with this list. Mark each check Pass, Fail or N/A. Items EcoSure cited at the last audit are flagged. Your answers are kept in this browser as you go, and saved for everyone when you select Submit.`) +
    (v.canWrite ? '' : '<div class="warnbox">You can view this page but not submit. Ask the page owner for Contributor access.</div>') +
    `<form id="selfform" class="panel"><div class="form">
      <label class="field"><span class="lbl">Kitchen</span><select id="sa-kitchen">${kitchens.map((k) => `<option${k === d.kitchen ? ' selected' : ''}>${esc(k)}</option>`).join('')}</select></label>
      <label class="field"><span class="lbl">Date</span><input type="date" id="sa-date" value="${esc(d.date)}"></label>
      <label class="field"><span class="lbl">Completed by</span><input type="text" id="sa-by" value="${esc(d.by)}" placeholder="Your name"></label>
    </div>
    <div class="progress" role="progressbar" aria-valuenow="${answered}" aria-valuemax="${stds.length}"><span style="width:${(answered / stds.length) * 100}%"></span></div>
    <p class="note">${answered} of ${stds.length} checks answered${prev ? ` · Last self-audit ${fmtDate(prev.date)} by ${esc(prev.by)}, readiness ${c.readiness == null ? 'n/a' : Math.round(c.readiness) + '%'}` : ''}</p>
    <div class="toolbar" style="margin:0"><button type="button" class="btn quiet sm" data-act="self-pass-rest">Mark the rest Pass</button><button type="button" class="btn quiet sm" data-act="self-reset">Clear answers</button></div></form>
    ${THEMES.map((t) => { const ss = stds.filter((s) => themeOf(s.short) === t.t); return ss.length ? `<section class="block"><div class="sechead"><h3>${esc(t.t)}</h3><p class="note">${esc(t.look)}</p></div><div class="checklist">${ss.map((s) => {
      const r = d.results[s.short];
      const a = cited.get(s.short);
      return `<div class="citem ${r?.r ?? ''}"><div class="cmain"><b>${esc(s.short)}</b> ${critChip((s.crit || 'Unrated') as Crit)}${a ? ` <span class="flagged">Cited ${fmtDate(a.date, true)}</span>` : ''}<span class="sub">${esc(PLAYBOOK[s.short]?.check ?? s.q)}</span></div>
        <div class="segs" role="group" aria-label="${esc(s.short)}">${btn(s, 'pass', 'Pass')}${btn(s, 'fail', 'Fail')}${btn(s, 'na', 'N/A')}</div>
        ${r?.r === 'fail' ? `<input type="text" class="cnote" id="note-${slug(s.short)}" data-note="${esc(s.short)}" value="${esc(r.note ?? '')}" placeholder="What was wrong and what you did about it">` : ''}</div>`;
    }).join('')}</div></section>` : ''; }).join('')}
    <div class="submitbar"><span class="note">${answered} of ${stds.length} answered</span><span class="grow"></span><button class="btn" data-act="self-submit"${v.canWrite && answered ? '' : ' disabled'}>Submit self-audit</button></div>`;
}

export function selfSummary(sa: SelfAudit): { fails: string[] } {
  return { fails: Object.entries(sa.results).filter(([, r]) => r.r === 'fail').map(([k]) => k) };
}

