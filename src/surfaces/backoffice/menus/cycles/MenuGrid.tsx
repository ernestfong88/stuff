import { Fragment, useMemo } from 'react';
import { CalendarDays, ChevronDown, Copy, Eraser, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { now } from '../../../../lib/clock';
import type { BoMenu, GridEntry, Recipe, RecipeCategory } from '../../../../store/menuEdits';
import { MenuDivider, MenuItem, Popover, cx, toast } from '../../../../ui';
import { placementSides, useBo } from '../data';
import { removePlacements, restorePlacements, setDayDate } from '../menuActions';
import { dishLong } from '../model/categories';
import { addDays, dayStart, isoDay, parseIsoDay, type CycleAnchor } from '../../../../domain/menuCycle';
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
    out.push({
      kind: 'starters',
      i,
      label: 'Soup or starter',
      cat: 'Starters',
    });
  const ne = Math.max(
    1,
    max((g) => g.entrees.length),
  );
  for (let i = 0; i < ne; i++) {
    out.push({
      kind: 'entree',
      i,
      label: ne > 1 ? `Entrée ${i + 1}` : 'Entrée',
      cat: 'Entrees',
    });
    out.push({
      kind: 'sides',
      i,
      label: 'Sides',
      sub: ne > 1 ? `with entrée ${i + 1}` : 'with the entrée',
      cat: 'Sides',
    });
  }
  for (let i = 0; i < max((g) => g.looseSides.length); i++)
    out.push({
      kind: 'looseSides',
      i,
      label: 'Other sides',
      sub: i ? '' : 'not tied to an entrée',
      cat: 'Sides',
    });
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
  readOnly,
}: {
  menu: BoMenu;
  days: number[];
  anchor: CycleAnchor | null;
  highlight: AiHighlight | null;
  onSlot: (t: SlotTarget) => void;
  onQuick: (r: Recipe, day: number) => void;
  onCopyDay: (day: number) => void;
  /** A locked menu: dishes show, but nothing can be added, moved or removed. */
  readOnly?: boolean;
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
        <button
          className={s.cardName}
          title={readOnly ? `${r?.name} · open the recipe` : `${r?.name} · change its sides`}
          onClick={() => r && onQuick(r, day)}
        >
          {r ? dishLong(r.name) : g.recipeId}
        </button>
        {!readOnly && (
          <button
            className={s.cardX}
            aria-label={`Remove ${r?.name ?? 'item'} from this day`}
            onClick={() => {
              removePlacements((x) => x.id === g.id);
              toast(`${r?.name ?? 'Item'} removed`, {
                action: {
                  label: 'Undo',
                  onClick: () => restorePlacements([g]),
                },
              });
            }}
          >
            <X size={11} />
          </button>
        )}
      </div>
    );
  };
  const slot = (t: SlotTarget, label: string) =>
    readOnly ? null : (
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
                  <DayMenu
                    day={d}
                    date={dt}
                    isToday={today === d}
                    readOnly={readOnly}
                    hasItems={bo.grid.some((x) => x.menuId === m.id && x.day === d)}
                    onCopy={() => onCopyDay(d)}
                    onClear={() => {
                      const removed = bo.grid.filter((x) => x.menuId === m.id && x.day === d);
                      removePlacements((x) => removed.includes(x));
                      toast(`Cleared ${dt ? dt.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' }) : `day ${d}`}`, {
                        action: {
                          label: 'Undo',
                          onClick: () => restorePlacements(removed),
                        },
                      });
                    }}
                    onDate={(v) => {
                      setDayDate(m.id, d, v);
                      toast(`Dates moved. ${v.getMonth() + 1}/${v.getDate()} is now in this column, and the other days moved with it.`);
                    }}
                  />
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
                      {!readOnly && (
                        <button
                          className={s.allWeek}
                          title={`Put one dish on ${meal.toLowerCase()} every day of this week`}
                          onClick={() => onSlot({ day: 0, meal, cat: null, allWeek: true })}
                        >
                          + Same dish all week
                        </button>
                      )}
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
                {!readOnly && (
                  <tr>
                    <td className={s.optHead} />
                    {days.map((d) => {
                      const has = placementsAt(bo.grid, m.id, d, meal).length > 0;
                      return (
                        <td key={d} className={cx(s.optCell, today === d && s.todayCol)}>
                          <Popover
                            align="center"
                            minWidth={220}
                            trigger={({ toggle }) => (
                              <button className={s.options} onClick={toggle} aria-label={`Add more to ${meal.toLowerCase()} on day ${d}`}>
                                <Plus size={13} aria-hidden /> Add more
                              </button>
                            )}
                          >
                            {({ close }) => (
                              <>
                                <div className={s.popHead}>Add to {meal.toLowerCase()}</div>
                                {(
                                  [
                                    ['Entrees', 'Another entrée'],
                                    ['Starters', 'Another soup or starter'],
                                    ['Sides', 'A side on its own'],
                                    ['Desserts', 'Another dessert'],
                                    ['Drinks', 'A drink'],
                                  ] as Array<[RecipeCategory, string]>
                                ).map(([c, label]) => (
                                  <MenuItem
                                    key={c}
                                    icon={<span className={cx(swatchClass, planClass(c))} />}
                                    onClick={() => {
                                      close();
                                      onSlot({ day: d, meal, cat: c });
                                    }}
                                  >
                                    {label}
                                  </MenuItem>
                                ))}
                                {has && (
                                  <>
                                    <MenuDivider />
                                    <MenuItem
                                      danger
                                      icon={<Eraser size={15} />}
                                      onClick={() => {
                                        const removed = bo.grid.filter((x) => x.menuId === m.id && x.day === d && x.meal === meal);
                                        removePlacements((x) => removed.includes(x));
                                        close();
                                        toast(`Cleared ${meal.toLowerCase()}`, {
                                          action: {
                                            label: 'Undo',
                                            onClick: () => restorePlacements(removed),
                                          },
                                        });
                                      }}
                                    >
                                      Clear {meal.toLowerCase()} on this day
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
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * A day's column heading: its date, and a menu to copy the day, clear it,
 * or move the cycle's dates.
 */
function DayMenu({
  day,
  date,
  isToday,
  readOnly,
  hasItems,
  onCopy,
  onClear,
  onDate,
}: {
  day: number;
  date: Date | null;
  isToday: boolean;
  readOnly?: boolean;
  hasItems: boolean;
  onCopy: () => void;
  onClear: () => void;
  onDate: (d: Date) => void;
}) {
  const [dating, setDating] = useState(false);
  const label = (
    <>
      {date ? (
        <>
          <span className={s.dateNum}>{date.getDate()}</span>
          <span className={s.dateWords}>
            <span>{date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}</span>
            <span className={s.dateSub}>{isToday ? 'TODAY' : date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}</span>
          </span>
        </>
      ) : (
        <span className={s.dateWords}>
          <span>DAY {day}</span>
          <span className={s.dateSub}>No date yet</span>
        </span>
      )}
    </>
  );
  if (readOnly)
    return (
      <span className={s.dayHeadIn}>
        <span className={s.dateBtn}>{label}</span>
      </span>
    );
  return (
    <span className={s.dayHeadIn}>
      <Popover
        align="left"
        minWidth={250}
        trigger={({ toggle }) => (
          <button
            className={s.dateBtn}
            onClick={() => {
              setDating(false);
              toggle();
            }}
            aria-label={`${date ? date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : `Day ${day}`}: copy, clear or change dates`}
          >
            {label}
            <ChevronDown size={13} className={s.dayChev} aria-hidden />
          </button>
        )}
      >
        {({ close }) =>
          dating ? (
            <div className={s.datePop}>
              <div className={s.datePopHead}>Which date is this column?</div>
              <input
                type="date"
                className={s.dateInput}
                autoFocus
                defaultValue={isoDay(date ?? dayStart(now()))}
                aria-label={`Date for day ${day}`}
                onChange={(e) => {
                  const v = parseIsoDay(e.target.value);
                  if (!v) return;
                  onDate(v);
                  setDating(false);
                  close();
                }}
              />
              <p className={s.datePopNote}>
                Every other day moves with it, so the cycle stays in order. Only the dates shown here change, not when venues serve the menu.
              </p>
            </div>
          ) : (
            <>
              <MenuItem
                icon={<Copy size={15} />}
                onClick={() => {
                  close();
                  onCopy();
                }}
              >
                Copy this day to other days
              </MenuItem>
              {hasItems && (
                <MenuItem
                  danger
                  icon={<Eraser size={15} />}
                  onClick={() => {
                    close();
                    onClear();
                  }}
                >
                  Clear this day
                </MenuItem>
              )}
              <MenuDivider />
              <MenuItem icon={<CalendarDays size={15} />} onClick={() => setDating(true)}>
                Change the dates shown
              </MenuItem>
            </>
          )
        }
      </Popover>
    </span>
  );
}
