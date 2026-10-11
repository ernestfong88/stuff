/** Small hand-built charts (HTML bars, SVG lines) that use the theme tokens. */
import { esc } from './util';

export interface BarRow {
  label: string;
  value: number;
  segs?: { v: number; color: string; title: string }[]; // stacked parts, sum = value
  go?: string; // route or action when clicked
  act?: string;
  title?: string;
  valueText?: string;
}

export function bars(rows: BarRow[], max = Math.max(1, ...rows.map((r) => r.value))): string {
  if (!rows.length) return '<div class="empty">Nothing to show for these filters.</div>';
  return `<div class="bars">${rows.map((r) => {
    const segs = r.segs ?? [{ v: r.value, color: 'var(--bar)', title: '' }];
    const fill = segs.filter((s) => s.v > 0).map((s) => `<span class="fill" style="width:calc(${(s.v / max) * 100}% - 2px);background:${s.color}" title="${esc(s.title || r.title || '')}"></span>`).join('');
    const tag = r.go || r.act ? 'button' : 'div';
    const attrs = r.go ? ` data-go="${esc(r.go)}"` : r.act ? ` data-act="${esc(r.act)}"` : '';
    return `<${tag} class="bar"${attrs} title="${esc(r.title ?? `${r.label}: ${r.valueText ?? r.value}`)}"><span class="name">${esc(r.label)}</span><span class="track">${fill}</span><span class="val">${esc(r.valueText ?? String(r.value))}</span></${tag}>`;
  }).join('')}</div>`;
}

/** Score history for one kitchen or community: dots joined by a line, bands at 70 and 85. */
export function scoreLine(points: { x: string; y: number | null; label: string }[], w = 520, h = 170): string {
  const pts = points.filter((p) => p.y != null) as { x: string; y: number; label: string }[];
  if (pts.length === 0) return '<div class="note">No scored audits yet.</div>';
  const pad = { l: 30, r: 14, t: 12, b: 26 };
  const lo = Math.min(40, ...pts.map((p) => p.y)) - 5, hi = 100;
  const X = (i: number) => pad.l + (pts.length === 1 ? (w - pad.l - pad.r) / 2 : (i / (pts.length - 1)) * (w - pad.l - pad.r));
  const Y = (v: number) => pad.t + ((hi - v) / (hi - lo)) * (h - pad.t - pad.b);
  const ticks = [50, 70, 85, 100].filter((t) => t >= lo);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p.y).toFixed(1)}`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="Score history" style="max-width:${w}px">
    ${ticks.map((t) => `<line class="gridline" x1="${pad.l}" x2="${w - pad.r}" y1="${Y(t)}" y2="${Y(t)}" ${t === 70 || t === 85 ? 'stroke-dasharray="3 3"' : ''}/><text x="${pad.l - 6}" y="${Y(t) + 4}" text-anchor="end">${t}</text>`).join('')}
    <path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2"/>
    ${pts.map((p, i) => `<g><title>${esc(p.label)}: ${p.y}</title><circle cx="${X(i)}" cy="${Y(p.y)}" r="5" fill="${p.y >= 85 ? 'var(--good)' : p.y >= 70 ? 'var(--maj)' : 'var(--crit)'}" stroke="var(--surface)" stroke-width="2"/></g>
      <text x="${X(i)}" y="${h - 8}" text-anchor="middle">${esc(p.x)}</text>`).join('')}
  </svg>`;
}

/** Tiny inline trend for tables. */
export function spark(vals: number[], w = 70, h = 20): string {
  if (vals.length < 2) return '';
  const lo = Math.min(...vals, 60), hi = 100;
  const X = (i: number) => 2 + (i / (vals.length - 1)) * (w - 4);
  const Y = (v: number) => 2 + ((hi - v) / (hi - lo)) * (h - 4);
  const last = vals[vals.length - 1];
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><path d="${vals.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join('')}" fill="none" stroke="var(--muted)" stroke-width="1.5"/><circle cx="${X(vals.length - 1)}" cy="${Y(last)}" r="3" fill="var(--accent)"/></svg>`;
}

export const CRIT_COLOR: Record<string, string> = { Critical: 'var(--crit)', Major: 'var(--maj)', Minor: 'var(--min)', Unrated: 'var(--line)' };

export function critLegend(): string {
  return `<div class="legend">${['Critical', 'Major', 'Minor'].map((c) => `<span><i style="background:${CRIT_COLOR[c]}"></i>${c}</span>`).join('')}</div>`;
}
