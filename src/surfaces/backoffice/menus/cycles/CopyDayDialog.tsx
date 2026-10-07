import { useState } from 'react';
import { ArrowLeftRight, Copy } from 'lucide-react';
import { dayTitle, type CycleAnchor } from '../../../../domain/menuCycle';
import { Button, Modal, Tabs, cx, toast } from '../../../../ui';
import { BoCallout } from '../../kit';
import { useBo } from '../data';
import { copyDay, restoreDays, swapDays, type DaySnapshot } from '../menuActions';
import { sameWeekday } from '../model/dayGroup';
import { dayCount } from '../model/dayOps';
import { BUILDER_MEALS, type BuilderMeal } from '../model/types';
import s from './CopyDayDialog.module.css';

export type DayAction = 'copy' | 'swap';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Copy one day of the cycle onto others (every meal or one, replacing what
 * is there or adding to it), or swap it with another day.
 */
export function CopyDayDialog({
  menuId,
  from,
  len,
  anchor,
  action: initial = 'copy',
  onClose,
}: {
  menuId: string;
  from: number;
  len: number;
  anchor: CycleAnchor | null;
  action?: DayAction;
  onClose: () => void;
}) {
  const bo = useBo();
  const [action, setAction] = useState<DayAction>(initial);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [meal, setMeal] = useState<'all' | BuilderMeal>('all');
  const [mode, setMode] = useState<'replace' | 'add'>('replace');
  const weeks = Math.ceil(len / 7);
  const swap = action === 'swap';
  const mealOf = swap || meal === 'all' ? undefined : meal;
  const count = (d: number, ml = mealOf) => dayCount(bo.grid, menuId, d, ml);
  const fromName = dayTitle(anchor, from);
  const weekOf = (d: number) => (weeks > 1 ? `Week ${Math.ceil(d / 7)} · ` : '');
  const name = (d: number) => weekOf(d) + dayTitle(anchor, d);
  const fromCount = count(from);
  const meals = BUILDER_MEALS.filter((ml) => ml !== 'Snacks' || count(from, ml) > 0);
  const what = mealOf ? mealOf.toLowerCase() : 'dishes';
  const targets = [...picked].sort((a, b) => a - b);
  const replaced = !swap && mode === 'replace' ? targets.filter((d) => count(d) > 0) : [];

  const pick = (d: number) =>
    setPicked((p) => {
      if (swap) return new Set(p.has(d) ? [] : [d]);
      const n = new Set(p);
      if (n.has(d)) n.delete(d);
      else n.add(d);
      return n;
    });
  const changeAction = (a: DayAction) => {
    setAction(a);
    if (a === 'swap' && picked.size > 1) setPicked(new Set([targets[0]]));
  };

  const undoToast = (msg: string, snap: DaySnapshot | null) => {
    if (!snap) {
      toast('This menu is locked, so its days cannot change', { tone: 'danger' });
      return;
    }
    toast(msg, { tone: 'success', action: { label: 'Undo', onClick: () => restoreDays(snap) } });
  };

  const run = () => {
    if (swap) {
      const to = targets[0];
      undoToast(`Swapped ${fromName} and ${dayTitle(anchor, to)}`, swapDays(menuId, from, to));
    } else {
      const where = targets.length === 1 ? dayTitle(anchor, targets[0]) : plural(targets.length, 'day');
      const which = mealOf ? `${fromName} ${mealOf.toLowerCase()}` : fromName;
      undoToast(`Copied ${which} to ${where}`, copyDay(menuId, from, targets, { meal: mealOf, mode }));
    }
    onClose();
  };

  const toCount = swap && targets.length ? count(targets[0]) : 0;
  const ready = swap ? targets.length === 1 && fromCount + toCount > 0 : targets.length > 0 && fromCount > 0;
  const label = swap
    ? targets.length
      ? `Swap with ${dayTitle(anchor, targets[0])}`
      : 'Pick a day to swap with'
    : targets.length
      ? `Copy to ${plural(targets.length, 'day')}`
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
            data-testid="day-action-go"
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
          { id: 'copy', label: 'Copy to other days', icon: <Copy size={14} /> },
          { id: 'swap', label: 'Swap with a day', icon: <ArrowLeftRight size={14} /> },
        ]}
      />

      {!swap && (
        <div className={s.opts}>
          <div className={s.opt}>
            <span className={s.optLabel}>Meals</span>
            <Tabs
              variant="segmented"
              size="sm"
              value={meal}
              onChange={setMeal}
              aria-label="Which meals to copy"
              options={[
                { id: 'all', label: 'All meals', count: count(from, undefined) },
                ...meals.map((ml) => ({ id: ml, label: ml, count: count(from, ml), disabled: !count(from, ml) })),
              ]}
            />
          </div>
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
        </div>
      )}

      <p className={s.lead}>
        {swap
          ? `Everything on ${fromName} (${plural(fromCount, 'dish', 'dishes')}) and the day you pick trades places, every meal, sides included.`
          : fromCount
            ? `${fromCount === 1 ? 'The 1 dish' : `All ${fromCount} dishes`} from ${mealOf ? `${fromName} ${mealOf.toLowerCase()}` : fromName} go onto the days you tick.`
            : `${fromName} has no ${what} yet, so there is nothing to copy.`}
      </p>

      {!swap && weeks > 1 && (
        <div className={s.quick}>
          <Button size="sm" onClick={() => setPicked(new Set(sameWeekday(from, len)))}>
            {anchor ? `Every ${fromName.split(' ')[0]} in the cycle` : 'Same day in every week'}
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
                  const on = picked.has(d);
                  const self = d === from;
                  const has = count(d);
                  const warn = on && !swap && mode === 'replace' && has > 0;
                  return (
                    <button
                      key={d}
                      className={cx(s.day, on && s.dayOn, warn && s.dayWarn, self && s.daySelf)}
                      disabled={self}
                      aria-pressed={on}
                      title={self ? `The day you are ${swap ? 'swapping' : 'copying'}` : has ? `${has} ${what} there now` : 'Nothing there yet'}
                      onClick={() => pick(d)}
                    >
                      <span className={s.dayName}>{dayTitle(anchor, d)}</span>
                      <span className={s.dayNote}>
                        {self ? (swap ? 'Swapping' : 'Copying') : has ? `${has} ${mealOf ? 'here' : 'dishes'}` : 'Empty'}
                      </span>
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
                <b>{name(replaced[0])}</b> has{' '}
                {plural(count(replaced[0]), mealOf ? `${mealOf.toLowerCase()} dish` : 'dish', mealOf ? `${mealOf.toLowerCase()} dishes` : 'dishes')};
                they will be replaced.
              </>
            ) : (
              <>
                {plural(replaced.length, 'day')} already have {what} that will be replaced:{' '}
                {replaced
                  .slice(0, 5)
                  .map((d) => `${name(d)} (${count(d)})`)
                  .join(', ')}
                {replaced.length > 5 ? ` and ${replaced.length - 5} more` : ''}.
              </>
            )}{' '}
            You can undo right after.
          </BoCallout>
        </div>
      )}
      {swap && targets.length === 1 && (
        <div className={s.warnBox}>
          <BoCallout tone="info">
            <b>{name(from)}</b> ({fromCount}) and <b>{name(targets[0])}</b> ({toCount}) trade places.
          </BoCallout>
        </div>
      )}
    </Modal>
  );
}
