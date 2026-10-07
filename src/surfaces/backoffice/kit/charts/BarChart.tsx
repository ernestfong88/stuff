import { useId, useState, type KeyboardEvent } from 'react';
import { cx } from '../../../../ui';
import { CHART } from './palette';
import { bandLayout, barGap, barHeight } from './scale';
import { useElementWidth } from './useElementWidth';
import s from './BarChart.module.css';

export interface BarSegment {
  value: number;
  color: string;
  /** Series name, for the tooltip. */
  name: string;
}

export interface BarDatum {
  key: string;
  /** Label under the bar; '' leaves the slot blank (thinned axis). */
  label: string;
  /** Stacked from the baseline up. Empty means no data: a grey stub is drawn. */
  segments: BarSegment[];
  /** Text above the bar, e.g. "21.8". */
  valueLabel?: string;
  valueColor?: string;
  /** Outline the bar (today). */
  highlight?: boolean;
  /** Full sentence for the tooltip and screen readers. */
  description: string;
}

export interface BarChartProps {
  data: BarDatum[];
  /** Accessible name of the whole chart. */
  label: string;
  /** Height of the plot area in px (labels are extra). */
  height?: number;
  /** Value at the baseline (default 0). */
  floor?: number;
  /** Value at the top of the plot (default: the tallest bar). */
  ceil?: number;
  /** Dashed reference line, e.g. the goal. */
  goal?: { value: number; label: string };
  /** Dashed line through the bar centres in the same scale, e.g. a running budget. */
  line?: { values: number[]; label: string };
  /** Bars become buttons that open a detail. */
  onSelect?: (index: number) => void;
}

const VALUE_ROOM = 16;
const AXIS_ROOM = 18;
const RADIUS = 3;

/**
 * Bar chart drawn in SVG: plain or stacked bars, optional value labels, a
 * goal line and an overlay line. Each bar is focusable and shows its
 * description on hover or focus; with onSelect, click / Enter opens it.
 */
export function BarChart({ data, label, height = 90, floor = 0, ceil, goal, line, onSelect }: BarChartProps) {
  const [wrap, width] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const clipBase = useId().replace(/:/g, '');
  const hasValues = data.some((d) => d.valueLabel);
  const top = hasValues ? VALUE_ROOM : 6;
  const total = (d: BarDatum) => d.segments.reduce((sum, x) => sum + x.value, 0);
  const max = ceil ?? Math.max(1, ...data.map(total), goal?.value ?? 0, ...(line?.values ?? [0]));
  const bands = bandLayout(data.length, width, barGap(data.length));
  const y = (v: number) => top + height - barHeight(v, floor, max, height);
  const svgHeight = top + height + AXIS_ROOM;
  const thin = data.length > 14;

  const onKey = (e: KeyboardEvent<SVGGElement>, i: number) => {
    if (!onSelect) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(i);
    }
  };

  const tip = hover != null && bands[hover] ? { d: data[hover], x: bands[hover].x + bands[hover].w / 2 } : null;

  return (
    <div ref={wrap} className={s.wrap}>
      {width > 0 && (
        <svg width={width} height={svgHeight} role="group" aria-label={label} className={s.svg}>
          <defs>
            {data.map((d, i) => {
              const b = bands[i];
              const h = barHeight(total(d), floor, max, height);
              return (
                <clipPath key={d.key} id={`${clipBase}-${i}`}>
                  <rect x={b.x} y={top + height - h} width={b.w} height={h + RADIUS} rx={Math.min(RADIUS, b.w / 2)} />
                </clipPath>
              );
            })}
          </defs>
          <line x1={0} x2={width} y1={top + height + 0.5} y2={top + height + 0.5} className={s.baseline} />
          {data.map((d, i) => {
            const b = bands[i];
            const sum = total(d);
            const empty = d.segments.length === 0 || sum <= 0;
            let base = floor;
            return (
              <g
                key={d.key}
                className={cx(s.bar, onSelect && s.clickable, hover === i && s.hovered)}
                role={onSelect ? 'button' : 'img'}
                tabIndex={0}
                aria-label={d.description}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                onClick={onSelect ? () => onSelect(i) : undefined}
                onKeyDown={(e) => onKey(e, i)}
              >
                <rect x={b.x} y={0} width={b.w} height={top + height} className={s.hit} />
                {empty ? (
                  <rect x={b.x} y={top + height - 3} width={b.w} height={3} rx={1} fill={CHART.empty} />
                ) : (
                  <g clipPath={`url(#${clipBase}-${i})`}>
                    {d.segments.map((seg, k) => {
                      const y0 = y(base);
                      base += seg.value;
                      const y1 = y(base);
                      // A thin surface gap between stacked parts keeps them apart without a legend squint.
                      const gap = k > 0 && seg.value > 0 ? 1.5 : 0;
                      return seg.value > 0 ? <rect key={k} x={b.x} y={y1} width={b.w} height={Math.max(0, y0 - y1 - gap)} fill={seg.color} /> : null;
                    })}
                  </g>
                )}
                {d.highlight && !empty && (
                  <rect x={b.x + 1} y={y(sum) + 1} width={Math.max(0, b.w - 2)} height={Math.max(0, top + height - y(sum) - 1)} rx={RADIUS} className={s.highlight} />
                )}
                <rect x={b.x - 1} y={1} width={b.w + 2} height={top + height + AXIS_ROOM - 2} rx={4} className={s.focus} />
                {d.valueLabel && (
                  <text x={b.x + b.w / 2} y={(empty ? top + height - 3 : y(sum)) - 4} className={cx(s.value, d.highlight && s.strong)} fill={d.valueColor ?? CHART.ink}>
                    {d.valueLabel}
                  </text>
                )}
                {d.label && (
                  <text x={b.x + b.w / 2} y={top + height + 13} className={cx(s.axis, d.highlight && s.strong, thin && s.axisThin)}>
                    {d.label}
                  </text>
                )}
              </g>
            );
          })}
          {goal && (
            <line x1={0} x2={width} y1={y(goal.value)} y2={y(goal.value)} className={s.goal}>
              <title>{goal.label}</title>
            </line>
          )}
          {line && bands.length === line.values.length && (
            <polyline points={line.values.map((v, i) => `${bands[i].x + bands[i].w / 2},${y(v)}`).join(' ')} className={s.line}>
              <title>{line.label}</title>
            </polyline>
          )}
        </svg>
      )}
      {tip && (
        <div className={s.tip} style={{ left: Math.min(Math.max(tip.x, 90), Math.max(90, width - 90)) }} role="presentation">
          {tip.d.description}
        </div>
      )}
    </div>
  );
}
