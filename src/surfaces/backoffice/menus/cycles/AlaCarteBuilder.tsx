import { useMemo, useState } from 'react';
import { ChevronLeft, Plus, X } from 'lucide-react';
import { now } from '../../../../lib/clock';
import type { BoMenu, Recipe, RecipeCategory } from '../../../../store/menuEdits';
import { Button, Tabs, cx, toast } from '../../../../ui';
import { BoCallout, BoPage } from '../../kit';
import { useBo } from '../data';
import { addPlacements, removePlacements, setAnyDayMeals } from '../menuActions';
import { dishLong, normCategory } from '../model/categories';
import { MEALS } from '../../../../domain/mealPeriods';
import { menuState, venuesAt } from '../../../../domain/menuCycle';
import { countAlc } from '../model/alcStandards';
import { roomVenue } from '../../../../store/venueMenu';
import { isUpchargeRecipe } from '../model/tablet';
import type { BuilderMeal } from '../model/types';
import { RecipeDialog } from '../recipes/RecipeDialog';
import { QuarterBadge, QuarterPick, StateChip } from '../ui/menuBits';
import { LockBanner, LockButton } from '../ui/MenuLock';
import { AlcCounter, alcWarnings } from './AlcCounter';
import { SlotSearch } from './SlotSearch';
import s from './AlaCarteBuilder.module.css';

const SECTIONS: Array<[RecipeCategory, string]> = [
  ['Starters', 'Soups and starters'],
  ['Entrees', 'Entrées'],
  ['Sides', 'Sides'],
  ['Desserts', 'Desserts'],
  ['Drinks', 'Drinks'],
  ['Snacks', 'Snacks'],
];

/** The meals a newly added dish is served at: the meal shown, else drinks all day and food at lunch and dinner. */
export function defaultMeals(cat: string, meal: string): BuilderMeal[] {
  if (meal !== 'All') return [meal as BuilderMeal];
  return normCategory(cat) === 'Drinks' ? [...MEALS] : ['Lunch', 'Dinner'];
}

interface Row {
  r: Recipe | undefined;
  id: string;
  cat: RecipeCategory;
  meals: Set<BuilderMeal>;
}

/**
 * À la carte builder: the standing menu, the same every day. Also edits a
 * menu cycle's every-day (Any Day) items, which servers order from at every
 * meal alongside the cycle's specials.
 */
export function AlaCarteBuilder({ menu: m, everyDay, onBack }: { menu: BoMenu; everyDay: boolean; onBack: () => void }) {
  const bo = useBo();
  const [meal, setMeal] = useState<string>('All');
  const [pick, setPick] = useState<RecipeCategory | null>(null);
  const [added, setAdded] = useState(0);
  const [edit, setEdit] = useState<Recipe | null>(null);
  const venues = useMemo(() => venuesAt(bo.venues, now()), [bo.venues]);
  const own = everyDay ? `${m.id}:everyday` : m.id;
  const where = venues.filter((v) => (!everyDay && v.menuId === m.id) || v.alcMenuId === own).map((v) => v.name);
  // Servers see it now when a room's tablets order from a venue that serves it (each room orders from its first active venue).
  const live = venues.some((v) => !!v.room && roomVenue(v.room, venues)?.id === v.id && ((!everyDay && v.menuId === m.id) || v.alcMenuId === own));

  const rows = useMemo(() => {
    const by = new Map<string, Row>();
    for (const g of bo.grid) {
      if (g.menuId !== m.id || g.day !== 0) continue;
      const r = bo.recipes.find((x) => x.id === g.recipeId);
      const row = by.get(g.recipeId) ?? {
        r,
        id: g.recipeId,
        cat: normCategory(r?.cat ?? g.cat),
        meals: new Set<BuilderMeal>(),
      };
      row.meals.add(g.meal);
      by.set(g.recipeId, row);
    }
    return [...by.values()].sort((a, b) => dishLong(a.r?.name ?? '').localeCompare(dishLong(b.r?.name ?? '')));
  }, [bo.grid, bo.recipes, m.id]);

  // The menu standard applies to every à la carte list, a cycle's every-day items included (venues serve it as their à la carte).
  const standard = m.kind === 'alc' || everyDay;
  const tally = useMemo(
    () =>
      countAlc(
        bo.grid.filter((g) => g.menuId === m.id && g.day === 0),
        (id) => bo.recipes.find((x) => x.id === id),
        (id) => isUpchargeRecipe(id),
      ),
    [bo.grid, bo.recipes, m.id],
  );
  const over = standard ? alcWarnings(tally) : [];

  const liveNote = live ? ' · servers see it now' : '';
  const readOnly = !!m.locked;
  const toggle = (row: Row, ml: BuilderMeal) => {
    const on = row.meals.has(ml);
    if (on && row.meals.size === 1) {
      toast('An item needs at least one meal. Remove it instead.', {
        tone: 'warning',
      });
      return;
    }
    setAnyDayMeals(m.id, row.id, on ? [...row.meals].filter((x) => x !== ml) : [...row.meals, ml]);
    toast(`${dishLong(row.r?.name ?? 'Item')} is ${on ? 'off' : 'on'} ${ml}${liveNote}`);
  };
  const add = (recipeId: string, cat: RecipeCategory) => {
    const ex = rows.find((x) => x.id === recipeId);
    const r = bo.recipes.find((x) => x.id === recipeId);
    if (ex && (meal === 'All' || ex.meals.has(meal as BuilderMeal))) {
      toast('Already on this menu');
      return;
    }
    if (ex) {
      setAnyDayMeals(m.id, recipeId, [...ex.meals, meal as BuilderMeal]);
      toast(`Added to ${meal}${liveNote}`, { tone: 'success' });
      return;
    }
    const meals = defaultMeals(r?.cat ?? cat, meal);
    addPlacements(meals.map((ml) => ({ menuId: m.id, recipeId, day: 0, meal: ml })));
    toast(`Added ${dishLong(r?.name ?? 'item')} · ${meals.join(' and ')}${liveNote}`, { tone: 'success' });
  };

  return (
    <BoPage
      wide
      title={everyDay ? `${m.name} · Every-day items` : m.name}
      sub={
        <span className={s.sub}>
          {everyDay ? <QuarterBadge q={m.quarter} big /> : <QuarterPick menu={m} at={now()} readOnly={readOnly} />}
          <StateChip state={menuState(m, venues)} />
          <span>{where.length ? `Served at ${where.join(', ')}` : 'Not on a venue yet'}</span>
        </span>
      }
      actions={
        standard || (!readOnly && !everyDay) ? (
          <span className={s.actions}>
            {standard && <AlcCounter count={tally} />}
            {!readOnly && !everyDay && <LockButton menu={m} />}
          </span>
        ) : undefined
      }
    >
      <button className={s.back} onClick={onBack}>
        <ChevronLeft size={16} aria-hidden /> All menus
      </button>
      {readOnly && <LockBanner menu={m} />}
      {over.length > 0 && (
        <BoCallout tone="danger" title={`Over the menu standard: reduce the menu by ${over.join(' and ')}.`}>
          The standard is {tally.limitItems} menu items, at most {tally.limitSides} of them sides; this menu has {tally.items} menu items and {tally.sides}{' '}
          {tally.sides === 1 ? 'side' : 'sides'}. Your changes still save.
        </BoCallout>
      )}
      <div className={s.meals}>
        <span className={s.mealLabel}>Show</span>
        <Tabs
          variant="segmented"
          size="sm"
          value={meal}
          onChange={setMeal}
          options={['All', ...MEALS].map((x) => ({
            id: x,
            label: x,
            count: x === 'All' ? rows.length : rows.filter((r) => r.meals.has(x as BuilderMeal)).length,
          }))}
          aria-label="Meal period"
        />
        {meal !== 'All' && !readOnly && <span className={s.mealHint}>Dishes you add go on {meal.toLowerCase()}.</span>}
      </div>
      {live && <p className={s.liveNote}>Servers order from this list, so a change shows on their tablets right away.</p>}

      <div className={s.sections}>
        {SECTIONS.map(([ck, label]) => {
          const list = rows.filter((x) => x.cat === ck && (meal === 'All' || x.meals.has(meal as BuilderMeal)));
          if (!list.length && (ck === 'Snacks' || meal !== 'All')) return null;
          return (
            <section key={ck} className={s.section}>
              <header className={s.secHead}>
                <h2 className={s.secTitle}>{label}</h2>
                <span className={s.count}>
                  {list.length} {list.length === 1 ? 'item' : 'items'}
                </span>
                {!readOnly &&
                  (pick === ck ? (
                    <span className={s.addSearch}>
                      <SlotSearch
                        key={added}
                        cat={ck}
                        placeholder={`Type ${label.toLowerCase()} to add`}
                        onCancel={() => setPick(null)}
                        onPick={(id) => {
                          add(id, ck);
                          // Stays open, empty, for the next one.
                          setAdded((n) => n + 1);
                        }}
                      />
                    </span>
                  ) : (
                    <Button size="sm" icon={<Plus size={13} />} onClick={() => setPick(ck)}>
                      Add {label.toLowerCase()}
                    </Button>
                  ))}
              </header>
              {!list.length && (
                <p className={s.none}>{meal === 'All' ? 'Nothing on the menu here yet.' : `Nothing here at ${meal.toLowerCase()}.`}</p>
              )}
              {list.map((row) => (
                <div key={row.id} className={s.row}>
                  <button className={s.name} onClick={() => row.r && setEdit(row.r)} disabled={!row.r}>
                    {row.r ? dishLong(row.r.name) : row.id}
                  </button>
                  <span className={s.chips}>
                    {MEALS.map((ml) =>
                      readOnly ? (
                        <span key={ml} className={cx(s.mealChip, s.mealStatic, row.meals.has(ml) && s.mealOn)}>
                          {ml}
                        </span>
                      ) : (
                        <button
                          key={ml}
                          aria-pressed={row.meals.has(ml)}
                          aria-label={`${row.r?.name ?? 'Dish'} at ${ml.toLowerCase()}`}
                          className={cx(s.mealChip, row.meals.has(ml) && s.mealOn)}
                          onClick={() => toggle(row, ml)}
                        >
                          {ml}
                        </button>
                      ),
                    )}
                  </span>
                  {!readOnly && (
                    <button
                      className={s.remove}
                      aria-label={`Remove ${row.r?.name ?? 'item'}`}
                      onClick={() => {
                        removePlacements((g) => g.menuId === m.id && g.day === 0 && g.recipeId === row.id);
                        toast(`Removed ${dishLong(row.r?.name ?? 'item')}${liveNote}`, {
                          action: {
                            label: 'Undo',
                            onClick: () =>
                              addPlacements(
                                [...row.meals].map((ml) => ({
                                  menuId: m.id,
                                  recipeId: row.id,
                                  day: 0,
                                  meal: ml,
                                })),
                              ),
                          },
                        });
                      }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </section>
          );
        })}
      </div>

      {edit && <RecipeDialog recipe={edit} onClose={() => setEdit(null)} />}
    </BoPage>
  );
}
