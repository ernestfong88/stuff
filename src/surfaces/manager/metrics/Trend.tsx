import { cx } from '../../../ui';
import s from './Trend.module.css';

export type TrendTone = 'good' | 'bad' | 'par';

/**
 * __KTrend: the last seven shifts in grey and this one in colour, with day
 * labels under it. The scale fits the values, so small changes still show.
 */
export function Trend({ values, tone, labels, height = 58 }: { values: Array<number | null>; tone: TrendTone; labels: string[]; height?: number }) {
  const known = values.filter((v): v is number => v != null);
  if (!known.length) return null;
  const max = Math.max(...known);
  const min = Math.min(...known);
  const range = Math.max(0.5, max - min);
  const px = (i: number) => 4 + (i * 92) / Math.max(1, values.length - 1);
  const py = (v: number) => 10 + (1 - (v - min) / range) * 80;
  const pts = values.map((v, i) => (v == null ? null : ([px(i), py(v)] as const))).filter((p): p is readonly [number, number] => p != null);
  const last = pts[pts.length - 1];
  const prev = pts[pts.length - 2];
  return (
    <div className={s.wrap}>
      <div className={s.chart} style={{ height }} aria-hidden="true">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={s.svg}>
          <polyline points={pts.slice(0, -1).map((p) => p.join(',')).join(' ')} className={s.line} vectorEffect="non-scaling-stroke" />
          {prev && <line x1={prev[0]} y1={prev[1]} x2={last[0]} y2={last[1]} className={cx(s.now, s[tone])} vectorEffect="non-scaling-stroke" />}
        </svg>
        {pts.map((p, i) => (
          <span
            key={i}
            className={cx(s.dot, i === pts.length - 1 && s.dotNow, i === pts.length - 1 && s[tone])}
            style={{ left: `${p[0]}%`, top: `${p[1]}%` }}
          />
        ))}
      </div>
      <div className={s.labels}>
        {labels.map((l, i) => (
          <span key={i} className={cx(s.label, i === labels.length - 1 && s.labelNow)}>
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}
