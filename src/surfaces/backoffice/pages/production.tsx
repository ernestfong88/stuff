/**
 * Production: the director plans what each venue makes, a week at a time
 * (this week and next). Cycle items come from the menu cycle with a
 * recommendation from past runs; the always-available dishes from average
 * sales on that weekday. A confirmed special's count is what Production Prep
 * is told to make.
 */
import { useState } from 'react';
import { Check, CheckCheck, Plus, Printer, X } from 'lucide-react';
import { uid } from '../../../lib/id';
import { useDining } from '../../../store/dining';
import {
  DEFAULT_DIRECTOR,
  PLAN_DAYS,
  PRODUCTION_VENUES,
  getProductionVenue,
  prepTasks,
  productionCount,
  productionDay,
  setPrepTasks,
  specialsMadeAndOrdered,
  updateProductionCounts,
  useProduction,
  type PrepMeal,
  type ProductionDay,
  type ProductionRow,
  type ProductionState,
} from '../../../store/production';
import { Button, Chip, Tabs, TextField, cx, toast } from '../../../ui';
import { BoPage, BoSection, NumberBox } from '../kit';
import type { BoPageProps } from '../nav';
import { printProductionSheets, printProductionWeek } from './productionPrint';
import s from './production.module.css';

const WEEK = 7;
const WEEKS = Math.ceil(PLAN_DAYS / WEEK);

function dayName(day: ProductionDay): string {
  if (day.offset === 0) return 'Today';
  if (day.offset === 1) return 'Tomorrow';
  return day.date.toLocaleDateString('en-US', { weekday: 'long' });
}

function shortDate(day: ProductionDay): string {
  return day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function weekRange(days: ProductionDay[]): string {
  const f = (d: ProductionDay) => d.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${f(days[0])} to ${f(days[days.length - 1])}`;
}

export default function Page(_props: BoPageProps) {
  const state = useProduction();
  const { assocOrders } = useDining();
  const [venueId, setVenueId] = useState(PRODUCTION_VENUES[0].id);
  const [week, setWeek] = useState(0);
  const [offset, setOffset] = useState(0);
  const venue = getProductionVenue(venueId);
  const weeks = Array.from({ length: WEEKS }, (_, w) => Array.from({ length: WEEK }, (_, i) => productionDay(venueId, w * WEEK + i)).filter((d) => d.offset < PLAN_DAYS));
  const days = weeks[week];
  const day = days.find((d) => d.offset === offset) ?? days[0];
  const meals = [...new Set(day.rows.map((r) => r.meal))];
  const confirmedIn = (d: ProductionDay) => d.rows.filter((r) => productionCount(state, venueId, d.iso, r).ok).length;
  const weekTotal = days.reduce((n, d) => n + d.rows.length, 0);
  const weekDone = days.reduce((n, d) => n + confirmedIn(d), 0);
  const preordered = (row: ProductionRow) =>
    assocOrders.filter((a) => a.date === day.iso && !/cancel/i.test(a.status || '') && a.item.toLowerCase() === row.name.toLowerCase()).length;
  const pickWeek = (w: number) => {
    setWeek(w);
    setOffset(w * WEEK);
  };
  const confirmWeek = () => {
    let n = 0;
    for (const d of days) {
      const open = d.rows.filter((r) => !productionCount(state, venueId, d.iso, r).ok);
      if (!open.length) continue;
      updateProductionCounts(venueId, d.iso, open, { ok: true, by: DEFAULT_DIRECTOR });
      n += open.length;
    }
    toast(`${n} ${n === 1 ? 'count' : 'counts'} confirmed for ${week === 0 ? 'this week' : 'next week'} at ${venue.name}`, { tone: 'success' });
  };

  return (
    <BoPage
      title={
        <span className={s.titleRow}>
          Production
          <Tabs
            variant="segmented"
            aria-label="Venue"
            value={venueId}
            onChange={setVenueId}
            options={PRODUCTION_VENUES.map((v) => ({ id: v.id, label: v.name }))}
          />
        </span>
      }
      sub={`Plan what ${venue.fullName} makes, a week at a time. Nothing is final until you confirm it.`}
      actions={
        <>
          <Button icon={<Printer size={15} />} onClick={() => printProductionSheets(venue.fullName, dayName(day), day, state, venueId)} disabled={!day.rows.length}>
            Print {dayName(day)}
          </Button>
          <Button
            variant="primary"
            icon={<Printer size={15} />}
            onClick={() => printProductionWeek(venue.fullName, days.map((d) => ({ label: `${dayName(d)} ${shortDate(d)}`, day: d })), state, venueId)}
            disabled={!weekTotal}
          >
            Print week
          </Button>
        </>
      }
    >
      <div className={s.weekBar}>
        <Tabs
          variant="segmented"
          aria-label="Week"
          value={String(week)}
          onChange={(w) => pickWeek(Number(w))}
          options={weeks.map((ds, w) => ({ id: String(w), label: `${w === 0 ? 'This week' : 'Next week'} · ${weekRange(ds)}` }))}
        />
        <span className={s.weekStatus}>
          {weekDone === weekTotal ? 'Every count this week is confirmed' : `${weekDone} of ${weekTotal} counts confirmed this week`}
        </span>
        {weekDone < weekTotal && (
          <Button size="sm" variant="soft" icon={<CheckCheck size={15} />} onClick={confirmWeek}>
            Confirm all this week
          </Button>
        )}
      </div>

      <div className={s.days} role="group" aria-label="Day">
        {days.map((d) => {
          const done = confirmedIn(d);
          const all = d.rows.length > 0 && done === d.rows.length;
          return (
            <button key={d.offset} aria-pressed={d.offset === day.offset} className={cx(s.day, d.offset === day.offset && s.dayOn)} onClick={() => setOffset(d.offset)}>
              <span className={s.dayName}>
                {d.offset < 2 ? dayName(d) : d.date.toLocaleDateString('en-US', { weekday: 'short' })} · {shortDate(d)}
              </span>
              <span className={s.dayMeta}>
                {d.cycleDay ? `Cycle day ${d.cycleDay} · ` : ''}
                {all ? 'All confirmed' : `${done} of ${d.rows.length}`}
              </span>
              {all && (
                <span className={s.ready}>
                  <Check size={12} strokeWidth={3} aria-hidden /> Ready
                </span>
              )}
            </button>
          );
        })}
      </div>

      <WeekGlance days={days} selected={day.offset} venueId={venueId} state={state} onPick={setOffset} />

      <h2 className={s.dayHeading}>
        {day.offset < 2 && `${dayName(day)} · `}
        {day.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
      </h2>

      {!day.rows.length && (
        <BoSection>
          <p className={s.empty}>Nothing to count for {venue.fullName} on this day.</p>
        </BoSection>
      )}

      {meals.map((meal) => (
        <MealCounts
          key={meal}
          meal={meal}
          rows={day.rows.filter((r) => r.meal === meal)}
          day={day}
          dayLabel={dayName(day)}
          venueId={venueId}
          state={state}
          preordered={preordered}
        />
      ))}

      <PrepTasks state={state} day={day} dayLabel={dayName(day)} />

      {day.offset === 0 && <MadeAndOrdered venueId={venueId} state={state} />}
    </BoPage>
  );
}

/**
 * The week on one screen: each meal's specials by day with how many to make,
 * so the director can see a run of fish or a heavy dessert day before
 * confirming. Sides are counted, not listed. Tap a day to edit it.
 */
function WeekGlance({ days, selected, venueId, state, onPick }: { days: ProductionDay[]; selected: number; venueId: string; state: ProductionState; onPick: (offset: number) => void }) {
  const meals = (['Breakfast', 'Lunch', 'Dinner'] as PrepMeal[]).filter((m) => days.some((d) => d.rows.some((r) => r.meal === m && r.kind === 'special')));
  if (!meals.length) return null;
  return (
    <BoSection flush title="Week at a glance" sub="Specials on the cycle and how many to make. A tick means the count is confirmed. Tap a day to change it.">
      <div className={s.tableWrap}>
        <table className={s.glance}>
          <thead>
            <tr>
              <th className={s.glanceMeal} aria-label="Meal" />
              {days.map((d) => (
                <th key={d.offset} className={d.offset === selected ? s.glanceOn : undefined}>
                  <button className={s.glanceDay} onClick={() => onPick(d.offset)}>
                    {d.date.toLocaleDateString('en-US', { weekday: 'short' })} {d.date.getDate()}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {meals.map((meal) => (
              <tr key={meal}>
                <th scope="row" className={s.glanceMeal}>
                  {meal}
                </th>
                {days.map((d) => {
                  const specials = d.rows.filter((r) => r.meal === meal && r.kind === 'special');
                  const shown = specials.filter((r) => r.category !== 'Sides');
                  const sides = specials.length - shown.length;
                  return (
                    <td key={d.offset} className={d.offset === selected ? s.glanceOn : undefined} onClick={() => onPick(d.offset)}>
                      {shown.length === 0 && <span className={s.glanceNone}>—</span>}
                      {shown.map((r) => {
                        const c = productionCount(state, venueId, d.iso, r);
                        return (
                          <div key={r.id} className={cx(s.glanceItem, r.entree && s.glanceEntree)}>
                            <span className={s.glanceName}>{r.name}</span>
                            <span className={cx(s.glanceMake, c.ok && s.glanceOk)}>
                              {c.ok && <Check size={11} strokeWidth={3} aria-label="Confirmed" />}
                              {c.make}
                            </span>
                          </div>
                        );
                      })}
                      {sides > 0 && <div className={s.glanceSides}>+ {sides} {sides === 1 ? 'side' : 'sides'}</div>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BoSection>
  );
}

interface MealCountsProps {
  meal: PrepMeal;
  rows: ProductionRow[];
  day: ProductionDay;
  dayLabel: string;
  venueId: string;
  state: ProductionState;
  preordered: (row: ProductionRow) => number;
}

function MealCounts({ meal, rows, day, dayLabel, venueId, state, preordered }: MealCountsProps) {
  const countOf = (r: ProductionRow) => productionCount(state, venueId, day.iso, r);
  const left = rows.filter((r) => !countOf(r).ok);
  const cycle = rows.filter((r) => r.kind === 'special');
  const anyDay = rows.filter((r) => r.kind === 'anyDay');
  const confirm = (list: ProductionRow[]) => updateProductionCounts(venueId, day.iso, list, { ok: true, by: DEFAULT_DIRECTOR });

  const row = (r: ProductionRow) => {
    const c = countOf(r);
    const pre = r.entree ? preordered(r) : 0;
    return (
      <tr key={r.id} className={c.ok ? s.confirmedRow : undefined}>
        <td>
          <div className={s.item}>{r.name}</div>
          <div className={s.itemSub}>{r.kind === 'anyDay' ? 'Any Day · always available' : r.category}</div>
        </td>
        <td className={s.basis}>{r.basis}</td>
        <td className={s.num}>
          {c.ok ? (
            <span className={s.made}>
              {c.make}
              {r.unit && <span className={s.unit}> {r.unit}</span>}
            </span>
          ) : (
            <>
              <NumberBox
                value={c.make}
                min={0}
                aria-label={`Make ${r.name}`}
                onChange={(v) => updateProductionCounts(venueId, day.iso, [r], { make: v ?? 0 })}
              />
              <div className={cx(s.rec, c.make !== r.recommended && s.recChanged)}>
                {r.unit ? `${r.unit} · ` : ''}rec {r.recommended}
              </div>
            </>
          )}
        </td>
        <td className={s.num}>
          {!r.entree ? (
            <span className={s.dash}>—</span>
          ) : c.ok ? (
            <span className={c.assoc ? s.made : s.none}>{c.assoc || 'None'}</span>
          ) : (
            <>
              <NumberBox
                value={c.assoc}
                min={0}
                width={56}
                placeholder="0"
                aria-label={`Associate meals of ${r.name}`}
                onChange={(v) => updateProductionCounts(venueId, day.iso, [r], { assoc: v })}
              />
              <div className={cx(s.rec, pre > 0 && s.recChanged)}>{pre ? `${pre} preordered` : "chef's count"}</div>
            </>
          )}
        </td>
        <td className={s.status}>
          {c.ok ? (
            <span className={s.statusDone}>
              <Chip tone="success" size="xs" icon={<Check size={11} strokeWidth={3} />}>
                Confirmed
              </Chip>
              <button className={s.link} onClick={() => updateProductionCounts(venueId, day.iso, [r], { ok: false })} aria-label={`Edit ${r.name}`}>
                Edit
              </button>
            </span>
          ) : (
            <Button size="sm" onClick={() => confirm([r])}>
              Confirm
            </Button>
          )}
        </td>
      </tr>
    );
  };

  return (
    <BoSection
      flush
      title={
        <span className={s.mealHead}>
          <span className={s.mealName}>{meal}</span>
          <span className={left.length ? s.mealCount : s.mealAll}>
            {left.length ? `${rows.length - left.length} of ${rows.length} confirmed` : `All ${rows.length} confirmed`}
          </span>
        </span>
      }
      actions={
        left.length > 0 && (
          <Button
            size="sm"
            variant="soft"
            onClick={() => {
              confirm(left);
              toast(`${meal}, ${dayLabel.toLowerCase()}: ${left.length} ${left.length === 1 ? 'count' : 'counts'} confirmed`, { tone: 'success' });
            }}
          >
            Confirm all for {meal.toLowerCase()}
          </Button>
        )
      }
    >
      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Item</th>
              <th>Basis</th>
              <th className={s.num}>Make</th>
              <th className={s.num}>Associates</th>
              <th aria-label="Status" />
            </tr>
          </thead>
          <tbody>
            {cycle.length > 0 && (
              <tr className={s.groupRow}>
                <td colSpan={5}>On the cycle · day {day.cycleDay}</td>
              </tr>
            )}
            {cycle.map(row)}
            {anyDay.length > 0 && (
              <tr className={s.groupRow}>
                <td colSpan={5}>Always available · prep from average sales</td>
              </tr>
            )}
            {anyDay.map(row)}
          </tbody>
        </table>
      </div>
    </BoSection>
  );
}

function PrepTasks({ state, day, dayLabel }: { state: ProductionState; day: ProductionDay; dayLabel: string }) {
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const all = prepTasks(state);
  const tasks = all.filter((t) => t.date === day.iso);
  const add = () => {
    if (!text.trim()) return;
    setPrepTasks([...all, { id: uid('pt'), date: day.iso, text: text.trim(), note: note.trim(), done: false }]);
    setText('');
    setNote('');
  };
  return (
    <BoSection title={`Prep tasks · ${dayLabel}`} sub={`${tasks.filter((t) => t.done).length} of ${tasks.length} done. Extra prep beyond the menu: trays, cookies, a birthday cake.`}>
      {!tasks.length && <p className={s.empty}>No extra prep for this day.</p>}
      <ul className={s.tasks}>
        {tasks.map((t) => (
          <li key={t.id} className={cx(s.task, t.done && s.taskDone)}>
            <label className={s.taskLabel}>
              <input type="checkbox" checked={t.done} onChange={() => setPrepTasks(all.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))} />
              <span>
                <span className={s.taskText}>{t.text}</span>
                {t.note && <span className={s.taskNote}> · {t.note}</span>}
              </span>
            </label>
            <Button variant="ghost" size="sm" iconOnly aria-label={`Delete ${t.text}`} icon={<X size={15} />} onClick={() => setPrepTasks(all.filter((x) => x.id !== t.id))} />
          </li>
        ))}
      </ul>
      <form
        className={s.addTask}
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <TextField className={s.taskInput} value={text} onChange={(e) => setText(e.target.value)} placeholder="What to make, e.g. Cookies for 40" aria-label="What to make" />
        <TextField className={s.noteInput} value={note} onChange={(e) => setNote(e.target.value)} placeholder="For, e.g. LE social 2 PM" aria-label="What it is for" />
        <Button type="submit" icon={<Plus size={15} />} disabled={!text.trim()}>
          Add task
        </Button>
      </form>
    </BoSection>
  );
}

function MadeAndOrdered({ venueId, state }: { venueId: string; state: ProductionState }) {
  const { orders, history, assocOrders } = useDining();
  const tallies = specialsMadeAndOrdered(state, venueId, [...orders, ...history], assocOrders);
  return (
    <BoSection title="Today's specials · made and ordered so far" sub="Made is the day's production count. Ordered counts every check rung in today and associate meals not cancelled.">
      {!tallies.length && <p className={s.empty}>No specials on today's menu here.</p>}
      <ul className={s.tallies}>
        {tallies.map((t) => {
          const tone = t.left < 0 ? 'danger' : t.left <= 5 ? 'warning' : 'success';
          const pct = t.made ? Math.min(100, (t.ordered / t.made) * 100) : 0;
          return (
            <li key={t.itemId} className={s.tally}>
              <div className={s.tallyHead}>
                <span className={s.tallyName}>{t.name}</span>
                <span className={s.tallyMeal}>{t.meal}</span>
                <span className={s.tallyCount}>
                  <strong>{t.ordered}</strong> ordered of <strong>{t.made}</strong> made
                </span>
                <Chip tone={tone} size="xs">
                  {t.left < 0 ? `${-t.left} over` : t.left === 0 ? 'Sold out' : `${t.left} left`}
                </Chip>
              </div>
              <div className={s.bar}>
                <div className={cx(s.fill, s[`fill_${tone}`])} style={{ width: `${pct}%` }} />
              </div>
              <div className={s.tallySplit}>
                {t.dineIn} dining room · {t.pickupDelivery} pick up and delivery · {t.associates} {t.associates === 1 ? 'associate' : 'associates'}
              </div>
            </li>
          );
        })}
      </ul>
    </BoSection>
  );
}
