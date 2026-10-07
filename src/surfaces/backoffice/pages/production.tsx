/**
 * Production: the director confirms what each venue makes today, tomorrow
 * and the day after. Cycle items come with a recommendation from past runs;
 * the always-available dishes from average sales on that weekday. A
 * confirmed special's count is what Production Prep is told to make.
 */
import { useState } from 'react';
import { Check, Plus, Printer, X } from 'lucide-react';
import { uid } from '../../../lib/id';
import { useDining } from '../../../store/dining';
import {
  DEFAULT_DIRECTOR,
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
import { printProductionSheets } from './productionPrint';
import s from './production.module.css';

const DAY_OFFSETS = [0, 1, 2];

function dayName(day: ProductionDay): string {
  if (day.offset === 0) return 'Today';
  if (day.offset === 1) return 'Tomorrow';
  return day.date.toLocaleDateString('en-US', { weekday: 'long' });
}

function shortDate(day: ProductionDay): string {
  return day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function Page(_props: BoPageProps) {
  const state = useProduction();
  const { assocOrders } = useDining();
  const [venueId, setVenueId] = useState(PRODUCTION_VENUES[0].id);
  const [offset, setOffset] = useState(0);
  const venue = getProductionVenue(venueId);
  const days = DAY_OFFSETS.map((o) => productionDay(venueId, o));
  const day = days[offset];
  const meals = [...new Set(day.rows.map((r) => r.meal))];
  const confirmedIn = (d: ProductionDay) => d.rows.filter((r) => productionCount(state, venueId, d.iso, r).ok).length;
  const preordered = (row: ProductionRow) =>
    assocOrders.filter((a) => a.date === day.iso && !/cancel/i.test(a.status || '') && a.item.toLowerCase() === row.name.toLowerCase()).length;

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
      sub={`Confirm what ${venue.fullName} makes today, tomorrow and the day after. Nothing is final until you confirm it.`}
      actions={
        <Button variant="primary" icon={<Printer size={15} />} onClick={() => printProductionSheets(venue.fullName, dayName(day), day, state, venueId)} disabled={!day.rows.length}>
          Print sheets
        </Button>
      }
    >
      <div className={s.days} role="group" aria-label="Day">
        {days.map((d) => {
          const done = confirmedIn(d);
          const all = d.rows.length > 0 && done === d.rows.length;
          return (
            <button key={d.offset} aria-pressed={d.offset === offset} className={cx(s.day, d.offset === offset && s.dayOn)} onClick={() => setOffset(d.offset)}>
              <span className={s.dayName}>
                {dayName(d)} · {shortDate(d)}
              </span>
              <span className={s.dayMeta}>
                {d.cycleDay ? `Cycle day ${d.cycleDay} · ` : ''}
                {all ? 'All confirmed' : `${done} of ${d.rows.length} confirmed`}
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

      {offset === 0 && <MadeAndOrdered venueId={venueId} state={state} />}
    </BoPage>
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
