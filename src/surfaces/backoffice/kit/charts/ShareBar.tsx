import s from './ShareBar.module.css';

export interface SharePart {
  key: string;
  name: string;
  value: number;
  color: string;
}

/**
 * One horizontal bar split into parts (positive / neutral / negative), with
 * an optional legend so identity never rests on colour alone.
 */
export function ShareBar({ parts, legend = true, height = 8, label }: { parts: SharePart[]; legend?: boolean; height?: number; label: string }) {
  const total = parts.reduce((sum, p) => sum + p.value, 0);
  const pct = (v: number) => (total ? Math.round((v / total) * 100) : 0);
  const summary = parts.map((p) => `${p.name} ${p.value} (${pct(p.value)}%)`).join(', ');
  return (
    <div>
      <svg className={s.bar} height={height} width="100%" role="img" aria-label={`${label}: ${summary}`} preserveAspectRatio="none" viewBox={`0 0 100 ${height}`}>
        {total > 0 ? (
          (() => {
            let x = 0;
            return parts.map((p) => {
              const w = (p.value / total) * 100;
              const r = <rect key={p.key} x={x} y={0} width={w} height={height} fill={p.color} />;
              x += w;
              return p.value > 0 ? r : null;
            });
          })()
        ) : (
          <rect x={0} y={0} width={100} height={height} fill="var(--sunken)" />
        )}
      </svg>
      {legend && (
        <div className={s.legend}>
          {parts.map((p) => (
            <span key={p.key} className={s.item}>
              <span className={s.swatch} style={{ background: p.color }} aria-hidden />
              {p.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Thin bar showing one value against the largest in its list. */
export function MeterBar({ value, max, color }: { value: number; max: number; color: string }) {
  const w = max > 0 ? Math.max(0, Math.min(1, value / max)) * 100 : 0;
  return (
    <span className={s.meter} aria-hidden>
      <span className={s.meterFill} style={{ width: `${w}%`, background: color }} />
    </span>
  );
}
