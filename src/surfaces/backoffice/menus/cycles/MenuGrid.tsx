import { Fragment, useMemo } from 'react';
import { Copy, MoreHorizontal, X } from 'lucide-react';
import { now } from '../../../../lib/clock';
import type { BoMenu, GridEntry, Recipe, RecipeCategory } from '../../../../store/menuEdits';
import { MenuDivider, MenuItem, Popover, cx, toast } from '../../../../ui';
import { placementSides, useBo } from '../data';
import { removePlacements, restorePlacements, setDayDate } from '../menuActions';
import { dishLong } from '../model/categories';
import { addDays, dayStart, isoDay, parseIsoDay, type CycleAnchor } from '../model/cycle';
import { groupDay, placementsAt, type DayGroup } from '../model/dayGroup';
import { BUILDER_MEALS, type BuilderMeal } from '../model/types';
import { PLAN_LABEL, planClass, swatchClass } from '../ui/menuBits';
import type { AiHighlight } from './AiReview';
import s from './MenuGrid.module.css';

/** Where a new placement goes. */
export interface SlotTarget {
  day: number;
  meal: BuilderMeal;
  cat: RecipeCategory | null;
  /** The entrée placement a side goes with. */
  with?: string;
  /** Every day of the week shown. */
  allWeek?: boolean;
}

type LaneKind = 'starters' | 'entree' | 'sides' | 'looseSides' | 'desserts' | 'drinks' | 'other';

interface Lane {
  kind: LaneKind;
  i: number;
  label: string;
  sub?: string;
  cat: RecipeCategory;
}

/** The rows a meal needs this week: as many entrées as the busiest day, each with its sides under it. */
function lanesFor(groups: DayGroup[]): Lane[] {
  const max = (f: (g: DayGroup) => number) => Math.max(0, ...groups.map(f));
  const out: Lane[] = [];
  for (
    let i = 0;
    i <
    Math.max(
      1,
      max((g) => g.starters.length),
    );
    i++
  )
    out.push({ kind: 'starters', i, label: 'Soup or starter', cat: 'Starters' });
  const ne = Math.max(
    1,
    max((g) => g.entrees.length),
  );
  for (let i = 0; i < ne; i++) {
    out.push({ kind: 'entree', i, label: ne > 1 ? `Entrée ${i + 1}` : 'Entrée', cat: 'Entrees' });
    out.push({ kind: 'sides', i, label: 'Sides', sub: ne > 1 ? `with entrée ${i + 1}` : 'with the entrée', cat: 'Sides' });
  }
  for (let i = 0; i < max((g) => g.looseSides.length); i++)
    out.push({ kind: 'looseSides', i, label: 'Other sides', sub: i ? '' : 'not tied to an entrée', cat: 'Sides' });
  for (
    let i = 0;
    i <
    Math.max(
      1,
      max((g) => g.desserts.length),
    );
    i++
  )
    out.push({ kind: 'desserts', i, label: 'Dessert', cat: 'Desserts' });
  for (let i = 0; i < max((g) => g.drinks.length); i++) out.push({ kind: 'drinks', i, label: 'Drink', cat: 'Drinks' });
  for (let i = 0; i < max((g) => g.other.length); i++) out.push({ kind: 'other', i, label: 'Other', cat: 'Snacks' });
  return out;
}

export function MenuGrid({
  menu: m,
  days,
  anchor,
  highlight,
  onSlot,
  onQuick,
  onCopyDay,
}: {
  menu: BoMenu;
  days: number[];
  anchor: CycleAnchor | null;
  highlight: AiHighlight | null;
  onSlot: (t: SlotTarget) => void;
  onQuick: (r: Recipe, day: number) => void;
  onCopyDay: (day: number) => void;
}) {
  const bo = useBo();
  const recipes = useMemo(() => new Map(bo.recipes.map((r) => [r.id, r])), [bo.recipes]);
  const nameOf = (id: string) => recipes.get(id)?.name ?? '';
  const today = anchor?.live ? anchor.today : null;

  const card = (g: GridEntry, day: number, side?: boolean) => {
    const r = recipes.get(g.recipeId);
    return (
      <div key={g.id} className={cx(s.card, planClass(g.cat))}>
        {side && (
          <span className={s.arrow} aria-hidden>
            ↳
          </span>
        )}
        <button className={s.cardName} title={`${r?.name} · ${g.cat} · click for quick edit`} onClick={() => r && onQuick(r, day)}>
          {r ? dishLong(r.name) : g.recipeId}
        </button>
        <button
          className={s.cardX}
          aria-label={`Remove ${r?.name ?? 'item'} from this day`}
          onClick={() => {
            removePlacements((x) => x.id === g.id);
            toast(`${r?.name ?? 'Item'} removed`, { action: { label: 'Undo', onClick: () => restorePlacements([g]) } });
          }}
        >
          <X size={11} />
        </button>
      </div>
    );
  };
  const slot = (t: SlotTarget, label: string) => (
    <button className={cx(s.slot, t.with && s.slotSide)} onClick={() => onSlot(t)}>
      + {label}
    </button>
  );

  const headDate = (d: number) => (anchor ? addDays(anchor.start, d - 1) : null);

  return (
    <div className={s.frame}>
      <table className={s.grid}>
        <thead>
          <tr>
            <th className={s.corner} />
            {days.map((d) => {
              const dt = headDate(d);
              return (
                <th key={d} className={cx(s.dayHead, today === d && s.today)}>
                  <span className={s.dayHeadIn}>
                    <Popover
                      align="left"
                      minWidth={240}
                      trigger={({ toggle }) => (
                        <button className={s.dateBtn} onClick={toggle} title="Click to change the date">
                          {dt ? (
                            <>
                              <span className={s.dateNum}>{dt.getDate()}</span>
                              <span className={s.dateWords}>
                                <span>{dt.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}</span>
                                <span className={s.dateSub}>{today === d ? 'TODAY' : dt.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}</span>
                              </span>
                            </>
                          ) : (
                            <span className={s.dateWords}>
                              <span>DAY {d}</span>
                              <span className={s.dateSub}>Set date</span>
                            </span>
                          )}
                        </button>
                      )}
                    >
                      {({ close }) => (
                        <div className={s.datePop}>
                          <div className={s.datePopHead}>Date for this column</div>
                          <input
                            type="date"
                            className={s.dateInput}
                            defaultValue={isoDay(dt ?? dayStart(now()))}
                            aria-label={`Date for day ${d}`}
                            onChange={(e) => {
                              const v = parseIsoDay(e.target.value);
                              if (!v) return;
                              setDayDate(m.id, d, v);
                              toast(`Dates moved. ${v.getMonth() + 1}/${v.getDate()} is now in this column.`);
                              close();
                            }}
                          />
                          <p className={s.datePopNote}>The other days move with it, so the cycle stays in order.</p>
                        </div>
                      )}
                    </Popover>
                    <button
                      className={s.copyBtn}
                      aria-label={`Copy Day ${d} to other days`}
                      title={`Copy Day ${d} to other days…`}
                      onClick={() => onCopyDay(d)}
                    >
                      <Copy size={12} />
                    </button>
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {BUILDER_MEALS.map((meal) => {
            const groups = days.map((d) => groupDay(placementsAt(bo.grid, m.id, d, meal), (rid) => placementSides(bo, m.id, d, rid).sides, nameOf));
            const lanes = lanesFor(groups);
            const hi = (d: number) =>
              !!highlight && highlight.day === d && (!highlight.meal || highlight.meal === meal || !/^(Lunch|Dinner)$/.test(highlight.meal));
            return (
              <Fragment key={meal}>
                <tr>
                  <td colSpan={days.length + 1} className={s.band}>
                    <span className={s.bandIn}>
                      <span className={s.mealName}>{meal}</span>
                      <button
                        className={s.allWeek}
                        title="Place one item on every day of this week"
                        onClick={() => onSlot({ day: 0, meal, cat: null, allWeek: true })}
                      >
                        + All week
                      </button>
                    </span>
                  </td>
                </tr>
                {lanes.map((ln) => (
                  <tr key={meal + ln.kind + ln.i}>
                    <th scope="row" className={s.laneHead}>
                      <span className={s.laneLabel}>
                        <span className={cx(swatchClass, planClass(ln.cat))} />
                        {ln.label}
                      </span>
                      {ln.sub && <span className={s.laneSub}>{ln.sub}</span>}
                    </th>
                    {days.map((d, di) => {
                      const g = groups[di];
                      let content: React.ReactNode = null;
                      if (ln.kind === 'entree') {
                        const e = g.entrees[ln.i];
                        content = e ? card(e.entree, d) : slot({ day: d, meal, cat: 'Entrees' }, PLAN_LABEL.Entrees);
                      } else if (ln.kind === 'sides') {
                        const e = g.entrees[ln.i];
                        content = e ? (
                          <div className={s.stack}>
                            {e.sides.map((x) => card(x, d, true))}
                            {slot({ day: d, meal, cat: 'Sides', with: e.entree.id }, 'Side')}
                          </div>
                        ) : null;
                      } else {
                        const it = g[ln.kind][ln.i];
                        content = it
                          ? card(it, d)
                          : ln.kind === 'starters' || ln.kind === 'desserts'
                            ? slot({ day: d, meal, cat: ln.cat }, PLAN_LABEL[ln.cat])
                            : null;
                      }
                      return (
                        <td key={d} className={cx(s.cell, ln.kind === 'sides' && s.sideCell, hi(d) && s.hi, today === d && s.todayCol)}>
                          {content}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr>
                  <td className={s.optHead} />
                  {days.map((d) => {
                    const has = placementsAt(bo.grid, m.id, d, meal).length > 0;
                    return (
                      <td key={d} className={cx(s.optCell, today === d && s.todayCol)}>
                        <Popover
                          align="center"
                          minWidth={190}
                          trigger={({ toggle }) => (
                            <button className={s.options} onClick={toggle} aria-label={`Options for day ${d} ${meal}`}>
                              <MoreHorizontal size={14} aria-hidden /> Options
                            </button>
                          )}
                        >
                          {({ close }) => (
                            <>
                              <div className={s.popHead}>Add item</div>
                              {(['Starters', 'Entrees', 'Sides', 'Desserts', 'Drinks'] as RecipeCategory[]).map((c) => (
                                <MenuItem
                                  key={c}
                                  icon={<span className={cx(swatchClass, planClass(c))} />}
                                  onClick={() => {
                                    close();
                                    onSlot({ day: d, meal, cat: c });
                                  }}
                                >
                                  {PLAN_LABEL[c]}
                                </MenuItem>
                              ))}
                              {has && (
                                <>
                                  <MenuDivider />
                                  <MenuItem
                                    danger
                                    onClick={() => {
                                      const removed = bo.grid.filter((x) => x.menuId === m.id && x.day === d && x.meal === meal);
                                      removePlacements((x) => removed.includes(x));
                                      close();
                                      toast(`Cleared ${meal} on Day ${d}`, { action: { label: 'Undo', onClick: () => restorePlacements(removed) } });
                                    }}
                                  >
                                    Clear this meal
                                  </MenuItem>
                                </>
                              )}
                            </>
                          )}
                        </Popover>
                      </td>
                    );
                  })}
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
