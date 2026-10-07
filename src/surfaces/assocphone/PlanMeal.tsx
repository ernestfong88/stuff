import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { rooms } from '../../data';
import type { AssocMeal, Order } from '../../domain/types';
import { Button, Chip, cx, useNow } from '../../ui';
import type { NewMeal } from './model/meals';
import { CLOSED_TEXT, closedReason, itemsLeft, menuFor, missingChoice, modsText } from './model/menu';
import type { AssocSettings } from './model/settings';
import { openWindows } from './model/planning';
import { dayName, nearestToBreak, shiftMeals, type Shift } from './model/shifts';
import {
  loadTag,
  minutesLabel,
  rangeLabel,
  windowCap,
  windowLoad,
  windowMinutes,
  type AssocMealName,
} from './model/windows';
import s from './PlanMeal.module.css';

interface PlanMealProps {
  shift: Shift;
  /** Salaried view: any range that is still open, not only during the shift. */
  anyTime: boolean;
  todayIso: string;
  settings: AssocSettings;
  meals: AssocMeal[];
  /** Every open and closed check, for range capacity. */
  orders: Order[];
  onBack: () => void;
  onPlan: (meal: NewMeal) => void;
}

/** Plan a meal for a shift: pick from the menu, make the choices, pick a pickup range. */
export function PlanMeal({ shift, anyTime, todayIso, settings, meals, orders, onBack, onPlan }: PlanMealProps) {
  const nowMs = useNow(30_000);
  const mealChoices = shiftMeals(shift.meal);
  const [meal, setMeal] = useState<AssocMealName>(mealChoices[0]);
  const [itemId, setItemId] = useState<string | null>(null);
  const [picked, setPicked] = useState<Record<string, string>>({});

  const menu = menuFor(shift.date, todayIso, settings.weeks, settings.fixed);
  const cap = windowCap(settings.caps, settings.venue);
  const open = openWindows(shift, meal, anyTime, settings, meals, nowMs);
  const loadOf = (w: string) => windowLoad(cap, settings.venue, w, shift.date, orders, meals);
  const bookable = open.filter((w) => !loadOf(w).full);
  const nearBreak = anyTime ? null : nearestToBreak(bookable, shift.breakAt);
  const [chosenWindow, setPickup] = useState<string | null>(null);
  const pickup = chosenWindow && bookable.includes(chosenWindow) ? chosenWindow : nearBreak;

  const item = menu?.find((x) => x.id === itemId) ?? null;
  const left = item ? itemsLeft(meals, shift.date, item) : null;
  const missing = item ? missingChoice(item, picked) : null;
  const ready = !!item && !!pickup && !missing && left !== 0;
  const action = !item ? 'Pick a meal' : missing ? `Pick a ${missing.group.toLowerCase()}` : !pickup ? 'Pick a pickup time' : 'Plan this meal';

  const place = () => {
    if (!ready || !item || !pickup) return;
    onPlan({ date: shift.date, meal, item: item.name, window: pickup, mods: picked, note: modsText(item, picked) });
  };

  const switchMeal = (m: AssocMealName) => {
    setMeal(m);
    setPickup(null);
  };

  const closed = closedReason(shift.date, todayIso, settings.weeks);

  return (
    <div className={s.screen}>
      <header className={s.head}>
        <button className={s.back} onClick={onBack}>
          <ChevronLeft size={18} strokeWidth={2.6} aria-hidden />
          Back
        </button>
        <h1 className={s.title}>
          {dayName(shift.date, todayIso)} · {meal}
        </h1>
      </header>
      {mealChoices.length > 1 && (
        <div className={s.mealChips} role="group" aria-label="Meal">
          {mealChoices.map((m) => (
            <button key={m} aria-pressed={meal === m} className={cx(s.chip, meal === m && s.chipOn)} onClick={() => switchMeal(m)}>
              {m}
            </button>
          ))}
        </div>
      )}

      <div className={s.body}>
        {!menu ? (
          <p className={s.closed}>{CLOSED_TEXT[closed ?? 'draft']}</p>
        ) : (
          <>
            <h2 className={s.cap}>Pick one · {rooms[settings.venue]?.name}</h2>
            <div className={s.menu}>
              {menu.map((x) => {
                const remaining = itemsLeft(meals, shift.date, x);
                const soldOut = remaining === 0;
                const on = itemId === x.id;
                return (
                  <div key={x.id}>
                    <button
                      className={cx(s.option, on && s.optionOn)}
                      disabled={soldOut}
                      aria-pressed={on}
                      onClick={() => {
                        setItemId(x.id);
                        setPicked({});
                      }}
                    >
                      <span className={s.optionText}>
                        <span className={s.optionName}>{x.name}</span>
                        <span className={s.optionSub}>{x.sub}</span>
                      </span>
                      {soldOut ? (
                        <Chip tone="danger" size="xs">
                          Sold out
                        </Chip>
                      ) : remaining != null ? (
                        <Chip tone={remaining <= 3 ? 'warning' : 'success'} size="xs">
                          {remaining} left
                        </Chip>
                      ) : (
                        <Chip size="xs">Included</Chip>
                      )}
                    </button>
                    {on &&
                      x.mods.map((g) => (
                        <div key={g.group} role="group" aria-label={g.group} className={s.mods}>
                          <div className={cx(s.modHead, !picked[g.group] && s.modNeeded)}>
                            {g.group}
                            {picked[g.group] ? '' : ' · pick one'}
                          </div>
                          <div className={s.modOptions}>
                            {g.options.map((v) => (
                              <button
                                key={v}
                                aria-pressed={picked[g.group] === v}
                                className={cx(s.chip, picked[g.group] === v && s.chipOn)}
                                onClick={() => setPicked((p) => ({ ...p, [g.group]: v }))}
                              >
                                {v}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                );
              })}
            </div>

            <h2 className={s.cap}>Pickup time{anyTime ? '' : ' · during your shift'}</h2>
            <div className={s.windows}>
              {open.map((w) => {
                const load = loadOf(w);
                const tag = loadTag(load);
                const near = !load.full && w === nearBreak;
                return (
                  <button
                    key={w}
                    disabled={load.full}
                    aria-pressed={pickup === w}
                    className={cx(s.chip, pickup === w && s.chipOn, near && pickup !== w && s.near, load.full && s.full)}
                    onClick={() => setPickup(w)}
                  >
                    {rangeLabel(windowMinutes(w) ?? 0)}
                    {tag ? ` · ${tag}` : near ? ' · near break' : ''}
                  </button>
                );
              })}
              {!open.length && <span className={s.none}>No pickup time left {anyTime ? 'for this day' : 'inside this shift'}.</span>}
            </div>
            <p className={s.foot}>
              {meal === 'NOC'
                ? `The kitchen is closed overnight, so the dinner line makes NOC meals before it closes at ${minutesLabel(settings.nocBy)} and sets them out for your range. NOC orders close at ${minutesLabel(settings.nocBy - settings.cutoffMin)} and no text is sent.`
                : `Each pickup time is a 15 minute range. Orders close ${settings.cutoffMin} min before the range starts. Associate meals don't take notes.`}
            </p>
            <Button variant="primary" size="lg" block disabled={!ready} onClick={place} className={s.confirm}>
              {action}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
