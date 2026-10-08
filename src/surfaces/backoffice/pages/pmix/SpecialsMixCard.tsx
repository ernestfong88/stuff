import { useState } from 'react';
import { cx } from '../../../../ui';
import { DonutChart, type DonutSlice } from '../../kit';
import { CATEGORY_OTHER, categoryHue } from '../../kit/charts/palette';
import { categoryName, pct, type MixItem } from './mix';
import s from './pmix.module.css';

/** One dish per step of the category's ramp, as on the dashboard wheel. */
const CUT = 4;

/** "Special entrées": the ring shows each special dish, the top four and the rest together, in the entrées' hue. */
export function SpecialsMixCard({ items, what, range }: { items: MixItem[]; what: string; range: string }) {
  const [hover, setHover] = useState<string | null>(null);
  const dishes = items
    .filter((x) => x.sp > 0)
    .map((x) => ({ r: x.r, n: x.sp }))
    .sort((a, b) => b.n - a.n);
  const T = dishes.reduce((q, x) => q + x.n, 0);
  const rest = dishes.slice(CUT);
  const restN = rest.reduce((q, x) => q + x.n, 0);
  const slices: DonutSlice[] = [
    ...dishes.slice(0, CUT).map((x, i) => ({ key: `sp${i}`, name: x.r.name, value: x.n, color: categoryHue(categoryName(x.r.cat)).ramp[i] })),
    ...(restN ? [{ key: 'spo', name: `Other specials (${rest.length})`, value: restN, color: CATEGORY_OTHER }] : []),
  ];
  const h = slices.find((x) => x.key === hover);
  const top = dishes[0];
  return (
    <section className={s.card} aria-label="Special entrées, what sold">
      <header className={s.cardHead}>
        <h2 className={s.cardTitle}>Special entrées, what sold</h2>
        <span className={s.cardRange}>
          {what} · {range}
        </span>
      </header>
      {!T ? (
        <p className={s.empty}>Nothing sold for these filters.</p>
      ) : (
        <div className={s.mixBody}>
          <div className={s.ring}>
            <DonutChart
              slices={slices}
              label="Special entrées by dish"
              center={
                h
                  ? [h.name.length > 22 ? h.name.slice(0, 21) + '…' : h.name, `${pct(h.value, T)}%`, `${h.value} sold`]
                  : ['Top special', `${pct(top?.n ?? 0, T)}%`, `${T} sold in all`]
              }
              hovered={hover}
              onHover={setHover}
              describe={(x) => `${x.name}: ${x.value} (${pct(x.value, T)}%)`}
            />
          </div>
          <div className={s.mixRight}>
            {top && (
              <p className={s.summary}>
                <b>Most popular: {top.r.name}</b>, {top.n} sold ({pct(top.n, T)}%) of special entrées.
              </p>
            )}
            <ul className={s.dishes}>
              {slices.map((x) => (
                <li
                  key={x.key}
                  className={cx(s.dish, hover === x.key && s.dishHover)}
                  onMouseEnter={() => setHover(x.key)}
                  onMouseLeave={() => setHover(null)}
                >
                  <span className={s.swatch} style={{ background: x.color }} aria-hidden />
                  <span className={s.dishName}>{x.key === 'spo' ? `Everything else (${rest.length})` : x.name}</span>
                  <span className={s.num}>{x.value}</span>
                  <span className={s.pctSmall}>{pct(x.value, T)}%</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
