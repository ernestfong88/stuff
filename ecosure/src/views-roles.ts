/** Communities of focus and the theme heat map. */
import { THEMES, themeOf } from './catalog';
import { AUDIT_LABEL, CAP_LABEL, type Audit, type CommunityView, type Model } from './model';
import { avg, esc, slug } from './util';
import { scorePill } from './views';

const slugOf = (m: Model, name: string) => m.communities.find((c) => c.c.name === name)?.slug ?? slug(name);

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
    ${names.map((c) => `<tr><td class="lab"><button class="linkbtn" data-go="c-${slugOf(m, c)}" title="${esc(c)}">${esc(m.settings.roster.find((r) => r.name === c)?.short || c)}</button></td>${THEMES.map((t) => cell(c, t.t)).join('')}<td class="num">${scorePill(avg(audits.filter((a) => a.community === c).map((a) => a.score)))}</td></tr>`).join('')}
    </tbody></table></div><div class="legend"><span>Points lost per theme in the latest audit of each kitchen.</span><span><i style="background:var(--hm1)"></i>Low</span><span><i style="background:var(--hm2)"></i>Medium</span><span><i style="background:var(--hm3)"></i>High</span></div>`;
}
