/** Communities of focus and the readiness playbook. */
import { THEMES, allStandards, themeOf, type Standard } from './catalog';
import { AUDIT_LABEL, CAP_LABEL, priorities, type Audit, type CommunityView, type Model } from './model';
import { PLAYBOOK } from './playbook';
import { fold } from './expand';
import type { Crit } from './types';
import { avg, countBy, esc, plural, slug } from './util';
import { latestPerKitchen, scorePill } from './views';


const critChip = (c: Crit) => `<span class="chip c-${c}">${c}</span>`;
const slugOf = (m: Model, name: string) => m.communities.find((c) => c.c.name === name)?.slug ?? slug(name);
const shareBtn = (label = 'Copy link to this page') => `<button class="btn ghost sm" data-act="share">${label}</button>`;
const head = (crumb: string, title: string, lede: string, extra = '') => `<div class="pagehead"><div><p class="crumb">${esc(crumb)}</p><h2 class="page">${esc(title)}</h2><p class="lede">${lede}</p></div><div class="pageacts">${extra}</div></div>`;

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

export function themeHeat(m: Model, audits: Audit[], names: string[]): string {
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
    return `<article class="pstd${focus === slug(s.short) ? ' hl' : ''}" id="p-${slug(s.short)}"><div class="stop"><h4>${esc(s.short)}</h4>${critChip((s.crit || 'Unrated') as Crit)}<span class="note">${s.cid ? esc(s.cid) + ' · ' : ''}${(({ Critical: 5, Major: 3, Minor: 1 }) as Record<string, number>)[s.crit] ?? 0} points</span>
      <span class="grow"></span>${p ? `<span class="cited">Cited at ${p.communities.length} of ${comms} communities</span>` : '<span class="cited ok">Not cited in the latest audits</span>'}</div>
      <p class="q">EcoSure checks: ${esc(s.q)}</p>
      ${play ? `<div class="pgrid"><div><span class="lbl">Have in place</span><ul>${play.have.map((h) => `<li>${esc(h)}</li>`).join('')}</ul></div><div><span class="lbl">30-second check</span><p>${esc(play.check)}</p></div>${ms.length ? `<div><span class="lbl">Most common misses</span><ul>${ms.map(([x, n]) => `<li>${esc(x)}${n > 1 ? ` <span class="note">(${n})</span>` : ''}</li>`).join('')}</ul></div>` : ''}</div>` : ''}
      ${p ? `<div class="factions"><button class="btn ghost sm" data-act="std:${esc(s.short)}">See ${plural(p.findings.length, 'finding')}</button></div>` : ''}</article>`;
  };
  const themes = filter.theme === 'all' ? THEMES : THEMES.filter((t) => t.t === filter.theme);
  const top5 = [...P.values()].slice(0, 5).map((p) => allStandards().find((s) => s.short === p.short)!).filter(Boolean);
  const browsing = !!focus || !!filter.q || filter.theme !== 'all' || filter.cited;
  const browse = `<div class="toolbar"><span class="lbl">Theme</span>${['all', ...THEMES.map((t) => t.t)].map((t) => `<button class="fbtn" data-pbtheme="${esc(t)}" aria-pressed="${filter.theme === t}">${t === 'all' ? 'All' : esc(t)}</button>`).join('')}</div>
    <div class="toolbar"><input type="search" id="pb-q" placeholder="Search the playbook" value="${esc(filter.q)}" aria-label="Search the playbook"><button class="fbtn" data-act="pb-cited" aria-pressed="${filter.cited}">Only standards cited in the latest audits</button></div>
    ${themes.map((t) => { const ss = list(t.t); return ss.length ? `<section class="block"><div class="sechead"><h3>${esc(t.t)}</h3><p class="note">${esc(t.look)}</p></div><div class="stds">${ss.map(card).join('')}</div></section>` : ''; }).join('') || '<div class="empty">No standards match.</div>'}`;
  return head('Readiness playbook', 'What every kitchen needs in place', `Start with the five standards kitchens miss most. Each shows what to have in place, a 30-second check, and what EcoSure found. All ${allStandards().length} standards are below.`, shareBtn()) +
    (browsing ? '' : `<section><h3>The five kitchens miss most</h3><div class="stds">${top5.map(card).join('')}</div></section>`) +
    `<section class="block">${fold('playbook-all', `All ${allStandards().length} standards by theme`, browse, browsing)}</section>`;
}

