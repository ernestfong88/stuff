import { Fragment, useMemo, useState } from 'react';
import { ArrowLeftRight, CalendarDays, ChevronDown, Copy, Eraser, Plus, X } from 'lucide-react';
import { now } from '../../../../lib/clock';
import type { BoMenu, GridEntry, Recipe, RecipeCategory } from '../../../../store/menuEdits';
import { MenuDivider, MenuItem, Popover, cx, toast } from '../../../../ui';
import { placementSides, useBo } from '../data';
import { removePlacements, restorePlacements, setDayDate, updateMenu } from '../menuActions';
import { dishLong } from '../model/categories';
import { addDays, dayStart, isoDay, parseIsoDay, type CycleAnchor } from '../../../../domain/menuCycle';
import { groupDay, placementsAt, type DayGroup } from '../model/dayGroup';
import { BUILDER_MEALS, type BuilderMeal } from '../model/types';
import { PLAN_LABEL, planClass, swatchClass } from '../ui/menuBits';
import type { AiHighlight } from './AiReview';
import { SlotSearch } from './SlotSearch';
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
  /** Opened from a day's Add more menu. */
  more?: boolean;
}

/** The default lanes a menu can drop for a meal (Soup or starter at breakfast ...). */
export type DefaultLane = 'starters' | 'entree' | 'desserts';
const LANE_NAME: Record<DefaultLane, string> = { starters: 'Soup or starter', entree: 'Entrée', desserts: 'Dessert' };

/** "Type another entrée" ... in a day's Add more slot. */
const MORE_LABEL: Record<string, string> = {
  Entrees: 'another entrée',
  Starters: 'another soup or starter',
  Sides: 'a side',
  Desserts: 'another dessert',
  Drinks: 'a drink',
};

const sameTarget = (a: SlotTarget | null, b: SlotTarget) =>
  !!a &&
  a.day === b.day &&
  a.meal === b.meal &&
  a.cat === b.cat &&
  (a.with ?? '') === (b.with ?? '') &&
  !!a.allWeek === !!b.allWeek &&
  !!a.more === !!b.more;

type LaneKind = 'starters' | 'entree' | 'sides' | 'looseSides' | 'desserts' | 'drinks' | 'other';

interface Lane {
  kind: LaneKind;
  i: number;
  label: string;
  sub?: string;
  cat: RecipeCategory;
  /** A default lane with nothing in it this week: the chef can take it off this meal. */
  removable?: boolean;
}

/**
 * The rows a meal needs this week: as many entrées as the busiest day, each
 * with its sides under it. Soup or starter, Entrée and Dessert always show one
 * empty row to fill, unless the menu has taken that row off this meal.
 */
function lanesFor(groups: DayGroup[], hidden: string[] = []): Lane[] {
  const max = (f: (g: DayGroup) => number) => Math.max(0, ...groups.map(f));
  const atLeast = (kind: DefaultLane) => (hidden.includes(kind) ? 0 : 1);
  const out: Lane[] = [];
  const ns = max((g) => g.starters.length);
  for (let i = 0; i < Math.max(atLeast('starters'), ns); i++)
    out.push({ kind: 'starters', i, label: 'Soup or starter', cat: 'Starters', removable: ns === 0 });
  const filled = max((g) => g.entrees.length);
  const ne = Math.max(atLeast('entree'), filled);
  for (let i = 0; i < ne; i++) {
    out.push({ kind: 'entree', i, label: ne > 1 ? `Entrée ${i + 1}` : 'Entrée', cat: 'Entrees', removable: filled === 0 });
    out.push({ kind: 'sides', i, label: 'Sides', sub: ne > 1 ? `with entrée ${i + 1}` : 'with the entrée', cat: 'Sides' });
  }
  for (let i = 0; i < max((g) => g.looseSides.length); i++)
    out.push({
      kind: 'looseSides',
      i,
      label: 'Other sides',
      sub: i ? '' : 'not tied to an entrée',
      cat: 'Sides',
    });
  const nd = max((g) => g.desserts.length);
  for (let i = 0; i < Math.max(atLeast('desserts'), nd); i++)
    out.push({ kind: 'desserts', i, label: 'Dessert', cat: 'Desserts', removable: nd === 0 });
  for (let i = 0; i < max((g) => g.drinks.length); i++) out.push({ kind: 'drinks', i, label: 'Drink', cat: 'Drinks' });
  for (let i = 0; i < max((g) => g.other.length); i++) out.push({ kind: 'other', i, label: 'Other', cat: 'Snacks' });
  return out;
}

export function MenuGrid({
  menu: m,
  days,
  anchor,
  highlight,
  onPlace,
  onQuick,
  onCopyDay,
  readOnly,
}: {
  menu: BoMenu;
  days: number[];
  anchor: CycleAnchor | null;
  highlight: AiHighlight | null;
  /** A recipe typed into a slot goes there. */
  onPlace: (recipeId: string, t: SlotTarget) => void;
  onQuick: (r: Recipe, day: number) => void;
  onCopyDay: (day: number, action: 'copy' | 'swap') => void;
  /** A locked menu: dishes show, but nothing can be added, moved or removed. */
  readOnly?: boolean;
}) {
  const bo = useBo();
  const recipes = useMemo(() => new Map(bo.recipes.map((r) => [r.id, r])), [bo.recipes]);
  const nameOf = (id: string) => recipes.get(id)?.name ?? '';
  const today = anchor?.live ? anchor.today : null;
  // The slot being typed into, if any.
  const [typing, setTyping] = useState<SlotTarget | null>(null);
  const search = (t: SlotTarget, placeholder: string, className?: string) => (
    <SlotSearch
      cat={t.cat}
      placeholder={placeholder}
      className={className}
      onCancel={() => setTyping(null)}
      onPick={(id) => {
        setTyping(null);
        onPlace(id, t);
      }}
    />
  );
  const hiddenLanes = (meal: string) => m.hiddenLanes?.[meal] ?? [];
  const setLaneHidden = (meal: string, lane: DefaultLane, hide: boolean) => {
    const now = hiddenLanes(meal);
    updateMenu(m.id, { hiddenLanes: { ...m.hiddenLanes, [meal]: hide ? [...now, lane] : now.filter((x) => x !== lane) } });
    toast(hide ? `${LANE_NAME[lane]} is off ${meal.toLowerCase()} on this menu` : `${LANE_NAME[lane]} is back on ${meal.toLowerCase()}`, {
      action: hide ? { label: 'Undo', onClick: () => setLaneHidden(meal, lane, false) } : undefined,
    });
  };

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
    readOnly ? null : sameTarget(typing, t) ? (
      search(t, `Type a ${label.toLowerCase()}`)
    ) : (
      <button className={cx(s.slot, t.with && s.slotSide)} onClick={() => setTyping(t)}>
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
                    onCopy={() => onCopyDay(d, 'copy')}
                    onSwap={() => onCopyDay(d, 'swap')}
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
            const hidden = hiddenLanes(meal);
            const lanes = lanesFor(groups, hidden);
            const allWeek: SlotTarget = { day: 0, meal, cat: null, allWeek: true };
            const hi = (d: number) =>
              !!highlight && highlight.day === d && (!highlight.meal || highlight.meal === meal || !/^(Lunch|Dinner)$/.test(highlight.meal));
            return (
              <Fragment key={meal}>
                <tr>
                  <td colSpan={days.length + 1} className={s.band}>
                    <span className={s.bandIn}>
                      <span className={s.mealName}>{meal}</span>
                      {!readOnly &&
                        (sameTarget(typing, allWeek) ? (
                          <span className={s.allWeekSearch}>{search(allWeek, 'Type one dish for every day this week')}</span>
                        ) : (
                          <button
                            className={s.allWeek}
                            title={`Put one dish on ${meal.toLowerCase()} every day of this week`}
                            onClick={() => setTyping(allWeek)}
                          >
                            + Same dish all week
                          </button>
                        ))}
                      {!readOnly &&
                        (hidden as DefaultLane[]).map((lane) => (
                          <button
                            key={lane}
                            className={s.laneBack}
                            onClick={() => setLaneHidden(meal, lane, false)}
                            title={`Show the ${LANE_NAME[lane].toLowerCase()} row again`}
                          >
                            + {LANE_NAME[lane]} row
                          </button>
                        ))}
                    </span>
                  </td>
                </tr>
                {lanes.map((ln) => (
                  <tr key={meal + ln.kind + ln.i}>
                    <th scope="row" className={s.laneHead}>
                      <span className={s.laneLabel}>
                        <span className={cx(swatchClass, planClass(ln.cat))} />
                        {ln.label}
                        {!readOnly && ln.removable && ln.i === 0 && (
                          <button
                            className={s.laneX}
                            aria-label={`Take the ${ln.label.toLowerCase()} row off ${meal.toLowerCase()} on this menu`}
                            title={`Take this row off ${meal.toLowerCase()}`}
                            onClick={() => setLaneHidden(meal, ln.kind as DefaultLane, true)}
                          >
                            <X size={12} />
                          </button>
                        )}
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
                      const more = typing?.more && typing.day === d && typing.meal === meal ? typing : null;
                      return (
                        <td key={d} className={cx(s.optCell, today === d && s.todayCol)}>
                          {more ? (
                            search(more, `Type ${MORE_LABEL[more.cat ?? 'Entrees']}`)
                          ) : (
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
                                        setTyping({ day: d, meal, cat: c, more: true });
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
                          )}
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
 * A day's column heading: its date, and a menu to copy the day, swap it, clear it,
 * or move the cycle's dates.
 */
function DayMenu({
  day,
  date,
  isToday,
  readOnly,
  hasItems,
  onCopy,
  onSwap,
  onClear,
  onDate,
}: {
  day: number;
  date: Date | null;
  isToday: boolean;
  readOnly?: boolean;
  hasItems: boolean;
  onCopy: () => void;
  onSwap: () => void;
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
            aria-label={`${date ? date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : `Day ${day}`}: copy, swap, clear or change dates`}
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
                Copy this day to…
              </MenuItem>
              <MenuItem
                icon={<ArrowLeftRight size={15} />}
                onClick={() => {
                  close();
                  onSwap();
                }}
              >
                Swap with…
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
