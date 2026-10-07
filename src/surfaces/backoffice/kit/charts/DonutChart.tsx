import type { KeyboardEvent } from 'react';
import { cx } from '../../../../ui';
import { ringSlicePath, sliceAngles } from './scale';
import s from './DonutChart.module.css';

export interface DonutSlice {
  key: string;
  name: string;
  value: number;
  color: string;
}

export interface DonutChartProps {
  slices: DonutSlice[];
  /** Accessible name of the chart. */
  label: string;
  /** Three short lines in the hole: caption, big figure, footnote. */
  center: [string, string, string];
  centerColor?: string;
  /** Slice under the pointer (controlled, so a legend can light it too). */
  hovered?: string | null;
  onHover?: (key: string | null) => void;
  /** Slices become buttons. */
  onSelect?: (key: string) => void;
  /** Describes a slice for its tooltip and screen readers. */
  describe: (slice: DonutSlice) => string;
  size?: number;
}

/** Ring chart in SVG. The hovered slice grows a little; each slice is focusable. */
export function DonutChart({ slices, label, center, centerColor, hovered, onHover, onSelect, describe, size = 220 }: DonutChartProps) {
  const shown = slices.filter((x) => x.value > 0);
  const angles = sliceAngles(shown.map((x) => x.value));
  // A hair of a gap between slices; skipped when one slice is the whole ring.
  const gap = shown.length > 1 ? 0.012 : 0;
  const onKey = (e: KeyboardEvent<SVGPathElement>, key: string) => {
    if (onSelect && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onSelect(key);
    }
  };
  return (
    <svg viewBox="0 0 240 240" width={size} height={size} role="group" aria-label={label} className={s.svg}>
      {shown.map((sl, i) => {
        const on = hovered === sl.key;
        const { a0, a1 } = angles[i];
        return (
          <path
            key={sl.key}
            d={ringSlicePath(120, 120, on ? 68 : 72, on ? 116 : 110, a0, Math.max(a0, a1 - gap))}
            fill={sl.color}
            className={cx(s.slice, onSelect && s.clickable)}
            role={onSelect ? 'button' : 'img'}
            tabIndex={0}
            aria-label={describe(sl)}
            onMouseEnter={() => onHover?.(sl.key)}
            onMouseLeave={() => onHover?.(null)}
            onFocus={() => onHover?.(sl.key)}
            onBlur={() => onHover?.(null)}
            onClick={onSelect ? () => onSelect(sl.key) : undefined}
            onKeyDown={(e) => onKey(e, sl.key)}
          >
            <title>{describe(sl)}</title>
          </path>
        );
      })}
      <text x={120} y={104} className={s.caption}>
        {center[0]}
      </text>
      <text x={120} y={138} className={s.big} fill={centerColor}>
        {center[1]}
      </text>
      <text x={120} y={158} className={s.foot}>
        {center[2]}
      </text>
    </svg>
  );
}
