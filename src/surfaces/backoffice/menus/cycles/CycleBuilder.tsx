import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, TriangleAlert } from 'lucide-react';
import { now } from '../../../../lib/clock';
import type { BoMenu, Recipe } from '../../../../store/menuEdits';
import { Button, EmptyState, cx, toast, useConfirm } from '../../../../ui';
import { BoCallout, BoPage } from '../../kit';
import { cycleLenOf, useBo } from '../data';
import { addPlacements, removePlacements, restorePlacements, setCycleLength } from '../menuActions';
import { addDays, menuAnchor, menuState, monthDay, venuesAt } from '../../../../domain/menuCycle';
import { emptyDays } from '../model/dayGroup';
import { RecipeDialog } from '../recipes/RecipeDialog';
import { Field, Select } from '../ui/controls';
import { LockBanner, LockButton } from '../ui/MenuLock';
import { PlanLegend, QuarterPick, StateChip } from '../ui/menuBits';
import { AiReview, type AiHighlight } from './AiReview';
import { CopyMealDialog, type MealAction } from './CopyMealDialog';
import type { BuilderMeal } from '../model/types';
import { MenuGrid, type SlotTarget } from './MenuGrid';
import { PrintMenus } from './PrintMenus';
import { QuickEdit } from './QuickEdit';
import s from './CycleBuilder.module.css';

const LENGTHS = [28, 35, 42, 49, 56, 63, 70];
const CONFIRM_MS = 3000;

/** The menu builder for a weekly cycle: one week of days at a time, by meal. */
export function CycleBuilder({ menu: m, onBack }: { menu: BoMenu; onBack: () => void }) {
  const bo = useBo();
  const [at] = useState(now);
  const venues = useMemo(() => venuesAt(bo.venues, at), [bo.venues, at]);
  const len = cycleLenOf(bo, m.id);
  const weeks = Math.ceil(len / 7);
  const anchor = menuAnchor(m, venues, len, at);
  const thisWeek = anchor?.live && anchor.today ? Math.ceil(anchor.today / 7) - 1 : -1;
  const [week, setWeek] = useState(Math.max(0, thisWeek));
  const [confirmClear, setConfirmClear] = useState(false);
  const clearTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(clearTimer.current), []);
  const [mealAct, setMealAct] = useState<{ day: number; meal: BuilderMeal; action: MealAction } | null>(null);
  const [quick, setQuick] = useState<{ r: Recipe; day: number } | null>(null);
  const [full, setFull] = useState<Recipe | null>(null);
  const [highlight, setHighlight] = useState<AiHighlight | null>(null);
  const [ask, confirmDialog] = useConfirm();
  const w = Math.min(week, Math.max(0, weeks - 1));
  const days = Array.from({ length: 7 }, (_, i) => w * 7 + i + 1).filter((d) => d <= len);
  const empty = emptyDays(bo.grid, m.id, len);
  const dayLabel = (d: number) => {
    const dt = anchor ? addDays(anchor.start, d - 1) : null;
    return dt ? `${dt.toLocaleDateString('en-US', { weekday: 'short' })} ${monthDay(dt)}` : `Day ${d}`;
  };

  const place = (recipeId: string, t: SlotTarget) => {
    const r = bo.recipes.find((x) => x.id === recipeId);
    if (t.allWeek) {
      addPlacements(days.map((d) => ({ menuId: m.id, recipeId, day: d, meal: t.meal })));
      toast(`${r?.name} added to ${t.meal.toLowerCase()} every day of week ${w + 1}`, { tone: 'success' });
    } else if (t.with) {
      addPlacements([
        {
          menuId: m.id,
          recipeId,
          day: t.day,
          meal: t.meal,
          cat: r?.cat ?? 'Sides',
          with: t.with,
        },
      ]);
      toast(`${r?.name} added under the entrée`, { tone: 'success' });
    } else {
      addPlacements([{ menuId: m.id, recipeId, day: t.day, meal: t.meal }]);
      toast(`${r?.name} added to ${dayLabel(t.day)} ${t.meal.toLowerCase()}`, {
        tone: 'success',
      });
    }
  };

  const readOnly = !!m.locked;

  /** A shorter cycle drops the weeks past it: ask first when they have dishes, and offer Undo. */
  const changeLength = async (next: number) => {
    const beyond = bo.grid.filter((g) => g.menuId === m.id && g.day > next);
    if (beyond.length) {
      const from = Math.floor(next / 7) + 1;
      const to = Math.ceil(Math.max(...beyond.map((g) => g.day)) / 7);
      const span = from === to ? `Week ${from} has` : `Weeks ${from} to ${to} have`;
      const ok = await ask({
        title: `Shorten to ${next / 7} weeks?`,
        message: `${span} ${beyond.length} ${beyond.length === 1 ? 'dish' : 'dishes'} on it. A ${next / 7}-week cycle doesn't have ${from === to ? 'that week' : 'those weeks'}, so ${beyond.length === 1 ? 'it comes' : 'they come'} off the menu. You can undo this.`,
        confirmLabel: `Remove ${from === to ? `week ${from}` : `weeks ${from} to ${to}`}`,
        tone: 'danger',
      });
      if (!ok) return;
    }
    const undo = setCycleLength(m.id, next);
    toast(`${m.name} is a ${next / 7}-week cycle${beyond.length ? ` · ${beyond.length} ${beyond.length === 1 ? 'dish' : 'dishes'} removed` : ''}`, {
      tone: 'success',
      action: { label: 'Undo', onClick: undo },
    });
  };

  return (
    <BoPage
      wide
      title={m.name}
      sub={
        <span className={s.sub}>
          <QuarterPick menu={m} at={at} readOnly={readOnly} />
          <StateChip state={menuState(m, venues)} />
        </span>
      }
      actions={
        <span className={s.actions}>
          {!readOnly && <LockButton menu={m} />}
          <PrintMenus menu={m} week={w} anchor={anchor} />
          {readOnly ? (
            <span className={s.lenText}>{weeks ? `${weeks}-week cycle` : 'No cycle length'}</span>
          ) : (
            <Field label="Cycle length">
              <Select
                size="sm"
                value={String(m.cycleLen || 0)}
                onChange={(v) => void changeLength(+v)}
                options={[
                  ...(LENGTHS.includes(m.cycleLen)
                    ? []
                    : [
                        {
                          value: String(m.cycleLen || 0),
                          label: 'Pick 4 to 10 weeks',
                          disabled: true,
                        },
                      ]),
                  ...LENGTHS.map((x) => ({
                    value: String(x),
                    label: `${x / 7} ${x === 7 ? 'week' : 'weeks'}`,
                  })),
                ]}
                aria-label="Cycle length"
              />
            </Field>
          )}
        </span>
      }
    >
      <button className={s.back} onClick={onBack}>
        <ChevronLeft size={16} aria-hidden /> All menus
      </button>

      {readOnly && <LockBanner menu={m} />}
      {confirmDialog}

      {!readOnly && len > 0 && empty.length === len && (
        <BoCallout tone="info">
          This menu is empty. <b>Fill from recipe book</b> fills every empty lunch and dinner slot at once, or go back and copy last season&apos;s menu.
        </BoCallout>
      )}

      {!readOnly && len > 0 && empty.length > 0 && empty.length < len && (
        <BoCallout tone="warning">
          <span className={s.warn}>
            <TriangleAlert size={14} aria-hidden />
            {empty.length === 1 ? 'One day has' : `${empty.length} days have`} nothing on them yet: {empty.slice(0, 6).map(dayLabel).join(', ')}
            {empty.length > 6 ? ` and ${empty.length - 6} more` : ''}. The every-day items still cover them.
          </span>
        </BoCallout>
      )}

      {!readOnly && len > 0 && (
        <AiReview
          menu={m}
          len={len}
          onGo={(t) => {
            setHighlight(t);
            setWeek(Math.ceil(t.day / 7) - 1);
          }}
        />
      )}

      {len > 0 ? (
        <>
          <div className={s.weekBar}>
            <div className={s.weekTabs} role="tablist" aria-label="Week of the cycle">
              {Array.from({ length: weeks }, (_, i) => {
                const lo = i * 7 + 1;
                const hi = Math.min(len, i * 7 + 7);
                return (
                  <button key={i} role="tab" aria-selected={i === w} className={cx(s.weekTab, i === w && s.weekOn)} onClick={() => setWeek(i)}>
                    <span className={s.weekName}>
                      {weeks === 1 ? 'The week' : `Week ${i + 1}`}
                      {i === thisWeek && <span className={s.nowDot}>Now</span>}
                    </span>
                    {anchor && (
                      <span className={s.weekDates}>
                        {monthDay(addDays(anchor.start, lo - 1))} to {monthDay(addDays(anchor.start, hi - 1))}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <span className={s.spacer} />
            {!readOnly && (
              <Button
                size="sm"
                variant={confirmClear ? 'danger' : 'softDanger'}
                onClick={() => {
                  if (!confirmClear) {
                    setConfirmClear(true);
                    clearTimer.current = window.setTimeout(() => setConfirmClear(false), CONFIRM_MS);
                    return;
                  }
                  window.clearTimeout(clearTimer.current);
                  const removed = bo.grid.filter((g) => g.menuId === m.id && days.includes(g.day));
                  removePlacements((g) => removed.includes(g));
                  setConfirmClear(false);
                  toast(`Cleared week ${w + 1}`, {
                    action: {
                      label: 'Undo',
                      onClick: () => restorePlacements(removed),
                    },
                  });
                }}
              >
                {confirmClear ? 'Tap again to clear this week' : 'Clear this week'}
              </Button>
            )}
          </div>

          <PlanLegend />

          <MenuGrid
            menu={m}
            days={days}
            anchor={anchor}
            highlight={highlight}
            readOnly={readOnly}
            onPlace={place}
            onQuick={(r, day) => (readOnly ? setFull(r) : setQuick({ r, day }))}
            onMealAction={(day, meal, action) => setMealAct({ day, meal, action })}
          />
        </>
      ) : (
        <EmptyState title="Choose how many weeks this cycle runs">Pick 4 to 10 weeks with Cycle length at the top right.</EmptyState>
      )}

      {mealAct && !readOnly && (
        <CopyMealDialog
          menuId={m.id}
          from={{ day: mealAct.day, meal: mealAct.meal }}
          action={mealAct.action}
          len={len}
          anchor={anchor}
          onClose={() => setMealAct(null)}
        />
      )}
      {quick && (
        <QuickEdit
          menuId={m.id}
          day={quick.day}
          recipe={quick.r}
          onClose={() => setQuick(null)}
          onFull={() => {
            setFull(quick.r);
            setQuick(null);
          }}
        />
      )}
      {full && <RecipeDialog recipe={full} onClose={() => setFull(null)} />}
    </BoPage>
  );
}
