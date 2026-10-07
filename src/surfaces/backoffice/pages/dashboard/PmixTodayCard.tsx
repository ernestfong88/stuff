import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { catalog } from '../../../../data';
import { isoDate } from '../../../../domain/pickup';
import { MEALS } from '../../../../domain/pickupService/meals';
import type { MealName } from '../../../../domain/types';
import { startOfToday } from '../../../../lib/clock';
import { useDining } from '../../../../store/dining';
import { Button, Tabs, cx } from '../../../../ui';
import { ringSlicePath, sliceAngles } from '../../kit/charts/scale';
import { SPECIALS_SOLD_EARLIER } from '../../seed/dashboard';
import { categoryDishes, categoryTotals, todayMix } from './model/todayMix';
import s from './dashboard.module.css';

/**
 * Categorical hues for the course categories (validated all-pairs for colour
 * blindness), each with a one-hue ramp, darkest first, for its dishes when
 * drilled in. Any other category is grey.
 */
const HUES: Record<string, { base: string; ramp: string[] }> = {
  Starters: { base: '#eb6834', ramp: ['#8f3810', '#c94f1e', '#eb6834', '#f0956a'] },
  Entrées: { base: '#2a78d6', ramp: ['#184f95', '#2a78d6', '#5598e7', '#86b6ef'] },
  Desserts: { base: '#1baf7a', ramp: ['#085c3d', '#0e7f56', '#1baf7a', '#50c497'] },
};
const GREY = { base: '#8a949b', ramp: ['#3a4751', '#5e6b74', '#8a949b', '#aeb6bc'] };
const OTHER = '#c9cfd3';
const hue = (cat: string) => HUES[cat] ?? GREY;

const plates = (n: number) => `${n} ${n === 1 ? 'plate' : 'plates'}`;

interface Slice {
  key: string;
  name: string;
  n: number;
  pct: number;
  color: string;
  note?: string;
}

/** P-Mix today: a wheel of the plates served so far by category; pick one to see its dishes. */
export function PmixTodayCard({ goto }: { goto: (pageId: string) => void }) {
  const { orders, history, assocOrders } = useDining();
  const todayStart = startOfToday();
  const [meal, setMeal] = useState<MealName | 'All'>('All');
  const [picked, setPicked] = useState<string | null>(null);
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
  const cats = categoryTotals(mix.dishes);
  // A meal without the picked category goes back to every category.
  const cat = cats.find((c) => c.category === picked) ?? null;
  const drill = cat ? categoryDishes(mix.dishes, cat.category) : null;

  const slices: Slice[] =
    drill && cat
      ? [
          ...drill.top.map((d, i) => ({
            key: d.id,
            name: d.name,
            n: d.n,
            pct: d.pct,
            color: hue(cat.category).ramp[Math.min(i, 3)],
            note: d.special ? 'Special' : undefined,
          })),
          ...(drill.rest
            ? [{ key: 'rest', name: 'Everything else', n: drill.rest.n, pct: drill.rest.pct, color: OTHER, note: `${drill.rest.dishes} dishes` }]
            : []),
        ]
      : cats.map((c) => ({ key: c.category, name: c.category, n: c.n, pct: c.pct, color: hue(c.category).base }));

  // Keep keyboard focus on the wheel as it changes: the back control after drilling in, the category's row after coming back.
  const backRef = useRef<HTMLButtonElement>(null);
  const rowRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const focusAfter = useRef<string | null>(null);
  useEffect(() => {
    const k = focusAfter.current;
    if (!k) return;
    focusAfter.current = null;
    (k === 'back' ? backRef.current : rowRefs.current[k])?.focus();
  }, [picked]);
  const open = (k: string, keyboard: boolean) => {
    if (keyboard) focusAfter.current = 'back';
    setPicked(k);
  };
  const back = () => {
    focusAfter.current = picked;
    setPicked(null);
  };

  const live = cat
    ? `${cat.category}: ${plates(cat.n)}, ${cat.dishes} ${cat.dishes === 1 ? 'dish' : 'dishes'}`
    : `All categories: ${plates(mix.tot)}`;

  return (
    <section className={s.card} aria-label="P-Mix today">
      <header className={s.cardHead}>
        <h2 className={s.cardCap}>P-Mix · served today</h2>
        <Button size="sm" variant="ghost" iconRight={<ChevronRight size={14} />} onClick={() => goto('pmix')}>
          Full P-Mix
        </Button>
      </header>
      {dayTot === 0 ? (
        <p className={s.muted}>Nothing served yet today.</p>
      ) : (
        <>
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
          <div className={s.wheelRow}>
            <Wheel
              slices={slices}
              label={cat ? `${cat.category} dishes` : 'Plates by category'}
              center={
                cat ? [cat.category, String(cat.n), cat.n === 1 ? 'plate' : 'plates'] : ['', String(mix.tot), mix.tot === 1 ? 'plate' : 'plates']
              }
              onPick={cat ? undefined : open}
            />
            <div className={s.wheelSide}>
              {cat && (
                <button ref={backRef} type="button" className={s.wheelBack} onClick={back}>
                  <ChevronLeft size={14} aria-hidden /> All categories
                </button>
              )}
              <ul className={s.wheelLegend} aria-label={cat ? `${cat.category} dishes` : 'Plates by category'}>
                {slices.map((x) => {
                  const body = (
                    <>
                      <span className={s.wheelSwatch} style={{ background: x.color }} aria-hidden />
                      <span className={s.wheelName}>{x.name}</span>
                      <span className={s.wheelN}>{x.n}</span>
                      <span className={s.wheelPct}>{x.pct}%</span>
                    </>
                  );
                  return (
                    <li key={x.key}>
                      {cat ? (
                        <div className={cx(s.wheelItem, s.wheelDish)} title={x.name}>
                          {body}
                        </div>
                      ) : (
                        <button
                          ref={(el) => {
                            rowRefs.current[x.key] = el;
                          }}
                          type="button"
                          className={cx(s.wheelItem, s.wheelPick)}
                          aria-label={`${x.name}, ${plates(x.n)}, ${x.pct}%`}
                          title={`Show the ${x.name.toLowerCase()} served`}
                          onClick={(e) => open(x.key, e.detail === 0)}
                        >
                          {body}
                          <ChevronRight size={13} aria-hidden className={s.wheelChev} />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
          <p className={s.chartNote}>{cat ? 'Share of the category.' : 'Pick a category to see its dishes.'} Drinks and sides left out.</p>
          <p className="sr-only" aria-live="polite">
            {live}
          </p>
        </>
      )}
    </section>
  );
}

const SIZE = 132;
const C = SIZE / 2;
const R0 = 40;
const R1 = 60;

/** The ring itself: each slice a button when it can be picked, with a hover tooltip. */
function Wheel({
  slices,
  label,
  center,
  onPick,
}: {
  slices: Slice[];
  label: string;
  center: [string, string, string];
  onPick?: (key: string, keyboard: boolean) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const angles = sliceAngles(slices.map((x) => x.n));
  const tipAt = slices.findIndex((x) => x.key === hover);
  const tip = tipAt >= 0 ? slices[tipAt] : null;
  const onKey = (e: KeyboardEvent<SVGPathElement>, key: string) => {
    if (onPick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onPick(key, true);
    }
  };
  return (
    <div className={s.wheel}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} role="group" aria-label={label}>
        {slices.map((x, i) => {
          const on = hover === x.key;
          const a = `${x.name}, ${plates(x.n)}, ${x.pct}%${x.note ? `, ${x.note.toLowerCase()}` : ''}`;
          return (
            <path
              key={x.key}
              d={ringSlicePath(C, C, R0, on ? R1 + 3 : R1, angles[i].a0, angles[i].a1)}
              fill={x.color}
              className={cx(s.wheelSlice, slices.length === 1 && s.wheelWhole, onPick && s.wheelSliceOn, tip && !on && s.wheelDim)}
              role={onPick ? 'button' : 'img'}
              tabIndex={onPick ? 0 : undefined}
              aria-label={a}
              onMouseEnter={() => setHover(x.key)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(x.key)}
              onBlur={() => setHover(null)}
              onClick={onPick ? () => onPick(x.key, false) : undefined}
              onKeyDown={(e) => onKey(e, x.key)}
            />
          );
        })}
        {center[0] && (
          <text x={C} y={C - 13} className={s.wheelCap}>
            {center[0].length > 11 ? center[0].slice(0, 10) + '…' : center[0]}
          </text>
        )}
        <text x={C} y={center[0] ? C + 7 : C + 3} className={s.wheelBig}>
          {center[1]}
        </text>
        <text x={C} y={center[0] ? C + 21 : C + 18} className={s.wheelCap}>
          {center[2]}
        </text>
      </svg>
      {tip && (
        <div className={s.wheelTip} role="presentation">
          <b>{tip.name}</b>
          <span>
            {plates(tip.n)} · {tip.pct}%{tip.note && ` · ${tip.note}`}
          </span>
        </div>
      )}
    </div>
  );
}
