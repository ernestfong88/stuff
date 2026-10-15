/**
 * Pieces shared by the dashboard and the community page, so both read the same way:
 * remediation status, pest findings and the criticality bar.
 */
import { CRIT_COLOR } from './charts';
import type { Finding, Model } from './model';

export const SEVS = ['Critical', 'Major', 'Minor'] as const;
export const pctOf = (x: number, n: number) => (n ? Math.round((x / n) * 100) : 0);

/** Remediated: the finding is on a corrective action plan filed in EcoSure (any status). */
export const isRemediated = (f: Finding) => !!f.capItem;
export const remediated = (fs: Finding[]) => fs.filter(isRemediated).length;
/** One status for a finding, or for a group of findings (the least finished one wins). */
export function status(fs: Finding[]): [string, string] {
  if (fs.every(isRemediated)) return ['Remediated', 'good'];
  if (fs.every((f) => isRemediated(f) || f.mitigated)) return [MITIGATED, 'warn'];
  return ['No CAP yet', 'bad'];
}
export const MITIGATED = 'Immediate risk remediated · full solution in progress';
export const statusChip = (fs: Finding[]) => { const [t, tone] = status(fs); return `<span class="chip t-${tone} plain">${t}</span>`; };

/** EcoSure's Insects/Rodents/Animals section. 10.1.1 is pest activity seen at the visit, a critical finding. */
export const isPest = (f: Finding) => f.section === 'Insects/Rodents/Animals' || f.cid.startsWith('10.');
export const isActivity = (f: Finding) => f.cid === '10.1.1' || f.short === 'No critical pest activity';
export const pestLabel = (f: Finding) => (isActivity(f) ? 'Pest activity' : f.cid === '10.2.1' || /outer openings/i.test(f.short) ? 'Pest entry points not sealed' : f.cid === '10.1.2' || /insect control/i.test(f.short) ? 'Insect control devices' : 'Pest prevention');

/** Violations by criticality as one bar; each part opens those findings (on the findings page, or in place when go is ''). */
export function critMix(items: Finding[], go = 'findings'): string {
  const to = go ? ` data-go="${go}"` : '';
  const sev = SEVS.map((x) => ({ x, n: items.filter((f) => f.criticality === x).length }));
  return `<div class="dmix"><span class="dl">Violations by criticality</span>
    <div class="dmixbar" role="img" aria-label="${sev.map((t) => `${t.n} ${t.x}`).join(', ')}">${sev.filter((t) => t.n).map((t) => `<button style="flex:${t.n};background:${CRIT_COLOR[t.x]}" ${to} data-crit="${t.x}" title="${t.n} ${t.x.toLowerCase()} (${pctOf(t.n, items.length)}%)"></button>`).join('')}</div>
    <div class="dmixlab">${sev.map((t) => `<button${to} data-crit="${t.x}"><i style="background:${CRIT_COLOR[t.x]}"></i>${t.x} <b>${t.n}</b> <span>${pctOf(t.n, items.length)}%</span></button>`).join('')}</div>
  </div>`;
}

/** One big number. go makes it a link; meter adds a progress bar under it (0 to 100). */
export function bigBox(label: string, value: string, o: { tone?: string; sub?: string; go?: string; crit?: string; cap?: string; meter?: number } = {}): string {
  const inner = `<span class="dl">${label}</span><b>${value}</b>${o.sub ? `<span class="ds">${o.sub}</span>` : ''}${o.meter != null ? `<span class="dmeter"><span style="width:${o.meter}%"></span></span>` : ''}`;
  return o.go ? `<button class="${o.tone ?? ''}" data-go="${o.go}"${o.crit ? ` data-crit="${o.crit}"` : ''}${o.cap ? ` data-cap="${o.cap}"` : ''}>${inner}</button>` : `<div class="${o.tone ?? ''}">${inner}</div>`;
}

/** The community's short name (Settings, "Short name"), used everywhere a community is listed. */
export const shortOf = (m: Model, name: string) => m.settings.roster.find((c) => c.name === name)?.short || name;

/** Pest status in plain words: act now (no plan), or remediated (a plan is filed; verify it held). */
export function pestStatus(fs: Finding[]): [string, string] {
  const [st] = status(fs);
  return st === 'Remediated' ? ['Remediated', 'good'] : ['Act now', 'bad'];
}
