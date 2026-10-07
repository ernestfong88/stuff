import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { catalog } from '../../../../data';
import { isoDate } from '../../../../domain/pickup';
import { MEALS } from '../../../../domain/pickupService/meals';
import type { MealName } from '../../../../domain/types';
import { startOfToday } from '../../../../lib/clock';
import { useDining } from '../../../../store/dining';
import { Button, Tabs } from '../../../../ui';
import { CHART, MeterBar, ShareBar } from '../../kit';
import { SPECIALS_SOLD_EARLIER } from '../../seed/dashboard';
import { todayMix, type MixRow } from './model/todayMix';
import { DetailsToggle, useRemembered } from './parts';
import s from './dashboard.module.css';

const OTHER = 'var(--s400)';

/** Specials in greens, à la carte in blues, darkest for the best seller of each, as on P-Mix. */
function shades(rows: MixRow[]): string[] {
  let sp = 0;
  let al = 0;
  return rows.map((r) => (r.special ? CHART.specials[Math.min(1 + sp++, 5)] : CHART.alaCarte[Math.min(1 + al++, 5)]));
}

/** P-Mix today: what has been served so far and each dish's share of the day. */
export function PmixTodayCard({ goto }: { goto: (pageId: string) => void }) {
  const { orders, history, assocOrders } = useDining();
  const todayStart = startOfToday();
  const [meal, setMeal] = useState<MealName | 'All'>('All');
  const [open, setOpen] = useRemembered('pmix', false);
  const mix = useMemo(
    () =>
      todayMix([...orders, ...history], assocOrders, {
        todayStart,
        todayIso: isoDate(0),
        catalog,
        earlier: SPECIALS_SOLD_EARLIER,
        meal: meal === 'All' ? undefined : meal,
      }),
    [orders, history, assocOrders, todayStart, meal],
  );
  const dayTot = MEALS.reduce((q, m) => q + mix.byMeal[m], 0);
  const colors = shades(mix.top);
  const max = Math.max(mix.top[0]?.n ?? 0, mix.rest?.n ?? 0);
  const rows = [
    ...mix.top.map((r, i) => ({ key: r.id, name: r.name, n: r.n, pct: r.pct, color: colors[i], note: '' })),
    ...(mix.rest
      ? [{ key: 'rest', name: 'Everything else', n: mix.rest.n, pct: mix.rest.pct, color: OTHER, note: `${mix.rest.dishes} dishes` }]
      : []),
  ];
  return (
    <section className={s.card} aria-label="P-Mix today">
      <header className={s.cardHead}>
        <h2 className={s.cardCap}>P-Mix · served today</h2>
        <Button size="sm" variant="ghost" iconRight={<ChevronRight size={14} />} onClick={() => goto('pmix')}>
          Full P-Mix
        </Button>
      </header>
      {mix.tot === 0 ? (
        <p className={s.muted}>{meal === 'All' ? 'Nothing served yet today.' : `Nothing served at ${meal.toLowerCase()} yet.`}</p>
      ) : (
        <>
          <p className={s.cardLine}>
            <b>{mix.tot}</b> plates served so far{meal !== 'All' && ` at ${meal.toLowerCase()}`}
            {mix.top[0] && (
              <>
                {' '}
                · <b>{mix.top[0].name}</b> leads at {mix.top[0].pct}%
              </>
            )}
          </p>
          <ShareBar
            label="Share of today's plates"
            legend={false}
            height={10}
            parts={rows.map((r) => ({ key: r.key, name: r.name, value: r.n, color: r.color }))}
          />
        </>
      )}
      {dayTot > 0 && <DetailsToggle open={open} onToggle={() => setOpen(!open)} controls="dash-pmix-detail" />}
      {open && dayTot > 0 && (
        <div id="dash-pmix-detail" className={s.details}>
          <Tabs
            variant="segmented"
            size="sm"
            className={s.pmixMeals}
            value={meal}
            onChange={setMeal}
            aria-label="Meal"
            options={[
              { id: 'All' as const, label: 'All' },
              // A meal with nothing served yet (dinner in the morning) cannot be picked.
              ...MEALS.map((m) => ({ id: m, label: m, count: mix.byMeal[m] || undefined, disabled: !mix.byMeal[m] })),
            ]}
          />
          {mix.tot > 0 && (
            <>
              <ul className={s.pmix}>
                {rows.map((r) => (
                  <li key={r.key} className={s.pmixRow}>
                    <span className={s.pmixSwatch} style={{ background: r.color }} aria-hidden />
                    <span className={s.pmixMain}>
                      <span className={s.pmixName}>
                        {r.name}
                        {r.note && <span className={s.pmixNote}> · {r.note}</span>}
                      </span>
                      <MeterBar value={r.n} max={max} color={r.color} />
                    </span>
                    <span className={s.pmixN}>{r.n}</span>
                    <span className={s.pmixPct}>{r.pct}%</span>
                  </li>
                ))}
              </ul>
              <div className={s.pmixLegend} aria-hidden>
                <span>
                  <span className={s.pmixSwatch} style={{ background: CHART.specials[1] }} /> Specials
                </span>
                <span>
                  <span className={s.pmixSwatch} style={{ background: CHART.alaCarte[1] }} /> À la carte
                </span>
              </div>
            </>
          )}
          <p className={s.chartNote}>
            Plates from every check rung in today, pick up and delivery, and associate meals. Drinks and sides are left out.
          </p>
        </div>
      )}
    </section>
  );
}
