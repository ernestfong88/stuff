import { useState } from 'react';
import { ArrowLeftRight, Copy } from 'lucide-react';
import { dayTitle, type CycleAnchor } from '../../../../domain/menuCycle';
import { Button, Modal, Tabs, cx, toast } from '../../../../ui';
import { BoCallout } from '../../kit';
import { useBo } from '../data';
import { copyMeal, restoreDays, swapMeals, type DaySnapshot } from '../menuActions';
import { sameWeekday } from '../model/dayGroup';
import { mealCount, type MealSlot } from '../model/dayOps';
import { BUILDER_MEALS, type BuilderMeal } from '../model/types';
import s from './CopyMealDialog.module.css';

export type MealAction = 'copy' | 'swap';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Copy one meal of the cycle onto other meals, on any days (Monday lunch onto
 * Wednesday dinner), replacing what is there or adding to it; or swap it with
 * another meal.
 */
export function CopyMealDialog({
  menuId,
  from,
  len,
  anchor,
  action: initial = 'copy',
  onClose,
}: {
  menuId: string;
  from: MealSlot;
  len: number;
  anchor: CycleAnchor | null;
  action?: MealAction;
  onClose: () => void;
}) {
  const bo = useBo();
  const [action, setAction] = useState<MealAction>(initial);
  const [toMeal, setToMeal] = useState<BuilderMeal>(from.meal as BuilderMeal);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [mode, setMode] = useState<'replace' | 'add'>('replace');
  const weeks = Math.ceil(len / 7);
  const swap = action === 'swap';
  const count = (day: number, meal: string = toMeal) => mealCount(bo.grid, menuId, { day, meal });
  const lower = (m: string) => m.toLowerCase();
  const slotName = (day: number, meal: string) => `${dayTitle(anchor, day)} ${lower(meal)}`;
  const fromName = slotName(from.day, from.meal);
  const weekOf = (d: number) => (weeks > 1 ? `Week ${Math.ceil(d / 7)} · ` : '');
  const fromCount = count(from.day, from.meal);
  const self = (d: number) => d === from.day && toMeal === from.meal;
  const targets = [...picked].filter((d) => !self(d)).sort((a, b) => a - b);
  const replaced = !swap && mode === 'replace' ? targets.filter((d) => count(d) > 0) : [];
  const meals = BUILDER_MEALS.filter((m) => m !== 'Snacks' || from.meal === 'Snacks');

  const pick = (d: number) =>
    setPicked((p) => {
      if (swap) return new Set(p.has(d) ? [] : [d]);
      const n = new Set(p);
      if (n.has(d)) n.delete(d);
      else n.add(d);
      return n;
    });
  const changeAction = (a: MealAction) => {
    setAction(a);
    if (a === 'swap' && picked.size > 1) setPicked(new Set([targets[0]]));
  };

  const undoToast = (msg: string, snap: DaySnapshot | null) => {
    if (!snap) {
      toast('This menu is locked, so its meals cannot change', { tone: 'danger' });
      return;
    }
    toast(msg, { tone: 'success', action: { label: 'Undo', onClick: () => restoreDays(snap) } });
  };

  const run = () => {
    if (swap) {
      const to = { day: targets[0], meal: toMeal };
      undoToast(`Swapped ${fromName} and ${slotName(to.day, to.meal)}`, swapMeals(menuId, from, to));
    } else {
      const where = targets.length === 1 ? slotName(targets[0], toMeal) : `${lower(toMeal)} on ${plural(targets.length, 'day')}`;
      undoToast(
        `Copied ${fromName} to ${where}`,
        copyMeal(
          menuId,
          from,
          targets.map((day) => ({ day, meal: toMeal })),
          mode,
        ),
      );
    }
    onClose();
  };

  const toCount = swap && targets.length ? count(targets[0]) : 0;
  const ready = swap ? targets.length === 1 && fromCount + toCount > 0 : targets.length > 0 && fromCount > 0;
  const label = swap
    ? targets.length
      ? `Swap with ${slotName(targets[0], toMeal)}`
      : 'Pick a day to swap with'
    : targets.length
      ? `Copy to ${targets.length === 1 ? slotName(targets[0], toMeal) : plural(targets.length, 'day')}`
      : 'Pick days to copy to';

  return (
    <Modal
      open
      onClose={onClose}
      title={swap ? `Swap ${fromName}` : `Copy ${fromName}`}
      width={640}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            icon={swap ? <ArrowLeftRight size={15} /> : <Copy size={15} />}
            disabled={!ready}
            onClick={run}
            data-testid="meal-action-go"
          >
            {label}
          </Button>
        </>
      }
    >
      <Tabs
        variant="segmented"
        size="sm"
        className={s.actionTabs}
        value={action}
        onChange={changeAction}
        aria-label="Copy or swap"
        options={[
          { id: 'copy', label: 'Copy to other meals', icon: <Copy size={14} /> },
          { id: 'swap', label: 'Swap with a meal', icon: <ArrowLeftRight size={14} /> },
        ]}
      />

      <div className={s.opts}>
        <div className={s.opt}>
          <span className={s.optLabel}>{swap ? 'Swap with' : 'Copy to'}</span>
          <Tabs
            variant="segmented"
            size="sm"
            value={toMeal}
            onChange={(m) => {
              setToMeal(m);
              if (m === from.meal) setPicked((p) => new Set([...p].filter((d) => d !== from.day)));
            }}
            aria-label={swap ? 'Meal to swap with' : 'Meal to copy to'}
            options={meals.map((m) => ({ id: m, label: m }))}
          />
        </div>
        {!swap && (
          <div className={s.opt}>
            <span className={s.optLabel}>Dishes already there</span>
            <Tabs
              variant="segmented"
              size="sm"
              value={mode}
              onChange={setMode}
              aria-label="What happens to dishes already there"
              options={[
                { id: 'replace', label: 'Replace them' },
                { id: 'add', label: 'Keep them, add these' },
              ]}
            />
          </div>
        )}
      </div>

      <p className={s.lead}>
        {!fromCount && !swap
          ? `${fromName} has no dishes yet, so there is nothing to copy.`
          : swap
            ? targets.length === 1
              ? `${fromName} (${fromCount}) and ${slotName(targets[0], toMeal)} (${toCount}) trade places, sides included.`
              : `Pick the day whose ${lower(toMeal)} trades places with ${fromName}.`
            : `${fromCount === 1 ? 'The 1 dish' : `All ${fromCount} dishes`} from ${fromName} go onto ${lower(toMeal)} on the days you tick.`}
      </p>

      {!swap && weeks > 1 && (
        <div className={s.quick}>
          <Button size="sm" onClick={() => setPicked(new Set(sameWeekday(from.day, len)))}>
            {anchor ? `Every ${dayTitle(anchor, from.day).split(' ')[0]} in the cycle` : 'Same day in every week'}
          </Button>
          {picked.size > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setPicked(new Set())}>
              Clear
            </Button>
          )}
        </div>
      )}

      <div className={s.weeks} role="group" aria-label={swap ? 'Day to swap with' : 'Days to copy to'}>
        {Array.from({ length: weeks }, (_, w) => (
          <div key={w} className={s.week}>
            <span className={s.weekLabel}>Week {w + 1}</span>
            <div className={s.days}>
              {Array.from({ length: 7 }, (_, i) => w * 7 + i + 1)
                .filter((d) => d <= len)
                .map((d) => {
                  const on = picked.has(d) && !self(d);
                  const has = count(d);
                  const warn = on && !swap && mode === 'replace' && has > 0;
                  return (
                    <button
                      key={d}
                      className={cx(s.day, on && s.dayOn, warn && s.dayWarn, self(d) && s.daySelf)}
                      disabled={self(d)}
                      aria-pressed={on}
                      onClick={() => pick(d)}
                    >
                      <span className={s.dayName}>{dayTitle(anchor, d)}</span>
                      <span className={s.dayNote}>{self(d) ? 'This meal' : has ? `${has} at ${lower(toMeal)}` : 'Empty'}</span>
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      </div>

      {replaced.length > 0 && (
        <div className={s.warnBox}>
          <BoCallout tone="warning">
            {replaced.length === 1 ? (
              <>
                <b>{weekOf(replaced[0]) + slotName(replaced[0], toMeal)}</b> has {plural(count(replaced[0]), 'dish', 'dishes')}; they will be
                replaced.
              </>
            ) : (
              <>
                {plural(replaced.length, 'day')} already have {lower(toMeal)} dishes that will be replaced:{' '}
                {replaced
                  .slice(0, 5)
                  .map((d) => `${dayTitle(anchor, d)} (${count(d)})`)
                  .join(', ')}
                {replaced.length > 5 ? ` and ${replaced.length - 5} more` : ''}.
              </>
            )}{' '}
            You can undo right after.
          </BoCallout>
        </div>
      )}
    </Modal>
  );
}
