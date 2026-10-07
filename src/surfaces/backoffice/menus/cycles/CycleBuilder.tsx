import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, TriangleAlert } from 'lucide-react';
import { now } from '../../../../lib/clock';
import type { BoMenu, Recipe } from '../../../../store/menuEdits';
import { Button, EmptyState, Modal, toast } from '../../../../ui';
import { BoCallout, BoPage } from '../../kit';
import { cycleLenOf, useBo } from '../data';
import { addPlacements, copyDay, removePlacements, restorePlacements, updateMenu } from '../menuActions';
import { addDays, menuAnchor, menuState, monthDay, venuesAt } from '../../../../domain/menuCycle';
import { emptyDays, parseDays } from '../model/dayGroup';
import { RecipeDialog } from '../recipes/RecipeDialog';
import { Field, Input, Select } from '../ui/controls';
import { PlanLegend, QuarterPick, StateChip } from '../ui/menuBits';
import { AiReview, type AiHighlight } from './AiReview';
import { MenuGrid, type SlotTarget } from './MenuGrid';
import { PrintMenus } from './PrintMenus';
import { QuickEdit } from './QuickEdit';
import { RecipePicker } from './RecipePicker';
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
  const [pick, setPick] = useState<SlotTarget | null>(null);
  const [copyFrom, setCopyFrom] = useState<number | null>(null);
  const [copyTo, setCopyTo] = useState('');
  const [quick, setQuick] = useState<{ r: Recipe; day: number } | null>(null);
  const [full, setFull] = useState<Recipe | null>(null);
  const [highlight, setHighlight] = useState<AiHighlight | null>(null);
  const w = Math.min(week, Math.max(0, weeks - 1));
  const days = Array.from({ length: 7 }, (_, i) => w * 7 + i + 1).filter((d) => d <= len);
  const empty = emptyDays(bo.grid, m.id, len);
  const nameOf = (id: string) => bo.recipes.find((r) => r.id === id)?.name ?? '';
  const dayLabel = (d: number) => {
    const dt = anchor ? addDays(anchor.start, d - 1) : null;
    return dt ? `${dt.toLocaleDateString('en-US', { weekday: 'short' })} ${monthDay(dt)}` : `Day ${d}`;
  };
  const weekLabel = (i: number) => {
    const lo = i * 7 + 1;
    const hi = Math.min(len, i * 7 + 7);
    return (
      (weeks === 1 ? 'The week' : `Week ${i + 1}`) +
      (anchor ? ` · ${monthDay(addDays(anchor.start, lo - 1))} to ${monthDay(addDays(anchor.start, hi - 1))}` : '') +
      (i === thisWeek ? ' (this week)' : '')
    );
  };

  const place = (recipeId: string, t: SlotTarget) => {
    const r = bo.recipes.find((x) => x.id === recipeId);
    if (t.allWeek) {
      addPlacements(days.map((d) => ({ menuId: m.id, recipeId, day: d, meal: t.meal })));
      toast(`${r?.name} → every day of week ${w + 1} · ${t.meal}`, { tone: 'success' });
    } else if (t.with) {
      addPlacements([{ menuId: m.id, recipeId, day: t.day, meal: t.meal, cat: r?.cat ?? 'Sides', with: t.with }]);
      toast(`${r?.name} added under the entrée`, { tone: 'success' });
    } else {
      addPlacements([{ menuId: m.id, recipeId, day: t.day, meal: t.meal }]);
      toast(`${r?.name} → ${dayLabel(t.day)} ${t.meal}`, { tone: 'success' });
    }
  };

  const pickTitle = (t: SlotTarget) => {
    if (t.allWeek) return `Add to every day this week · ${t.meal}`;
    if (t.with) {
      const e = bo.grid.find((g) => g.id === t.with);
      return `Add a side for ${e ? nameOf(e.recipeId) : 'this entrée'} · ${dayLabel(t.day)}`;
    }
    return `Add to ${dayLabel(t.day)} · ${t.meal}`;
  };

  const doCopy = () => {
    if (copyFrom == null) return;
    const targets = parseDays(copyTo, len, copyFrom);
    if (targets.length && bo.grid.some((g) => g.menuId === m.id && g.day === copyFrom)) {
      copyDay(m.id, copyFrom, targets);
      toast(`Copied Day ${copyFrom} into day${targets.length > 1 ? 's' : ''} ${targets.join(', ')}`, { tone: 'success' });
    }
    setCopyFrom(null);
    setCopyTo('');
  };

  return (
    <BoPage
      title={m.name}
      sub={
        <span className={s.sub}>
          <QuarterPick menu={m} at={at} />
          <StateChip state={menuState(m, venues)} />
          {anchor?.live && weeks > 0 && (
            <span>
              Today is week {Math.ceil((anchor.today ?? 1) / 7)} of {weeks}
            </span>
          )}
        </span>
      }
      actions={
        <span className={s.actions}>
          <PrintMenus menu={m} week={w} anchor={anchor} />
          <Field label="Cycle length">
            <Select
              size="sm"
              value={String(m.cycleLen || 0)}
              onChange={(v) => updateMenu(m.id, { cycleLen: +v })}
              options={[
                ...(LENGTHS.includes(m.cycleLen) ? [] : [{ value: String(m.cycleLen || 0), label: 'Pick 4 to 10 weeks', disabled: true }]),
                ...LENGTHS.map((x) => ({ value: String(x), label: `${x / 7} weeks` })),
              ]}
              aria-label="Cycle length"
            />
          </Field>
        </span>
      }
    >
      <button className={s.back} onClick={onBack}>
        <ChevronLeft size={16} aria-hidden /> Menu Cycle &amp; À la Carte
      </button>

      {len > 0 && empty.length > 0 && (
        <BoCallout tone="warning">
          <span className={s.warn}>
            <TriangleAlert size={14} aria-hidden />
            {empty.length} day{empty.length !== 1 ? 's' : ''} in the cycle {empty.length !== 1 ? 'have' : 'has'} nothing placed yet (
            {empty.slice(0, 10).join(', ')}
            {empty.length > 10 ? '…' : ''}). Any Day items still cover them.
          </span>
        </BoCallout>
      )}

      {len > 0 && (
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
            <span className={s.showing}>Showing</span>
            <Button size="sm" iconOnly icon={<ChevronLeft size={16} />} aria-label="Previous week" disabled={w <= 0} onClick={() => setWeek(w - 1)} />
            <Select
              value={String(w)}
              onChange={(v) => setWeek(+v)}
              options={Array.from({ length: weeks }, (_, i) => ({ value: String(i), label: weekLabel(i) }))}
              aria-label="Week"
              className={s.weekSel}
            />
            <Button size="sm" iconOnly icon={<ChevronRight size={16} />} aria-label="Next week" disabled={w >= weeks - 1} onClick={() => setWeek(w + 1)} />
            {thisWeek >= 0 && w !== thisWeek && (
              <Button size="sm" variant="ghost" onClick={() => setWeek(thisWeek)}>
                This week
              </Button>
            )}
            <span className={s.spacer} />
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
                toast(`Cleared week ${w + 1}`, { action: { label: 'Undo', onClick: () => restorePlacements(removed) } });
              }}
            >
              {confirmClear ? 'Tap again to clear this week' : 'Clear week'}
            </Button>
          </div>

          <MenuGrid
            menu={m}
            days={days}
            anchor={anchor}
            highlight={highlight}
            onSlot={setPick}
            onQuick={(r, day) => setQuick({ r, day })}
            onCopyDay={(d) => {
              setCopyFrom(d);
              setCopyTo('');
            }}
          />
          <PlanLegend note="Sides sit under the entrée they go with. Click a date to change it. Click an item for a quick edit." />
        </>
      ) : (
        <EmptyState title="Set a cycle length to see weeks">
          Pick 4 to 10 weeks at the top. The every-day items for this menu are on the À la carte menus tab.
        </EmptyState>
      )}

      {pick && (
        <RecipePicker
          title={pickTitle(pick)}
          cat={pick.cat}
          placeholder={pick.allWeek ? `Search, then pick one item for all ${days.length} days` : undefined}
          onPick={(id) => place(id, pick)}
          onClose={() => setPick(null)}
        />
      )}
      {copyFrom != null && (
        <Modal
          open
          onClose={() => setCopyFrom(null)}
          title={`Copy Day ${copyFrom} to…`}
          width={400}
          footer={
            <>
              <Button variant="ghost" onClick={() => setCopyFrom(null)}>
                Cancel
              </Button>
              <Button variant="primary" disabled={!copyTo.trim()} onClick={doCopy}>
                Copy
              </Button>
            </>
          }
        >
          <Field label="Target days" hint={`Separate with commas or spaces, for example 7, 8, 9 (1 to ${len})`}>
            <Input
              autoFocus
              value={copyTo}
              placeholder="7, 8, 9"
              onChange={(e) => setCopyTo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && doCopy()}
            />
          </Field>
          <p className={s.copyNote}>Every placement on Day {copyFrom} lands on each target day. Existing items on those days are kept.</p>
        </Modal>
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
