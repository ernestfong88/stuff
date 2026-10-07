import { useMemo, useState } from 'react';
import { ChevronLeft, Plus, X } from 'lucide-react';
import { now } from '../../../../lib/clock';
import type { BoMenu, Recipe, RecipeCategory } from '../../../../store/menuEdits';
import { Button, Tabs, cx, toast } from '../../../../ui';
import { BoPage } from '../../kit';
import { useBo } from '../data';
import { addPlacements, removePlacements, setAnyDayMeals } from '../menuActions';
import { dishLong, normCategory } from '../model/categories';
import { menuState, venuesAt } from '../model/cycle';
import { DINING_VENUE_ID } from '../model/liveOverlay';
import type { BuilderMeal } from '../model/types';
import { RecipeDialog } from '../recipes/RecipeDialog';
import { QuarterBadge, QuarterPick, StateChip } from '../ui/menuBits';
import { RecipePicker } from './RecipePicker';
import s from './AlaCarteBuilder.module.css';

const MEALS: BuilderMeal[] = ['Breakfast', 'Lunch', 'Dinner'];
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
  return normCategory(cat) === 'Drinks' ? MEALS : ['Lunch', 'Dinner'];
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
  const [edit, setEdit] = useState<Recipe | null>(null);
  const venues = useMemo(() => venuesAt(bo.venues, now()), [bo.venues]);
  const where = venues.filter((v) => v.menuId === m.id).map((v) => v.name);
  const live = venues.some((v) => v.id === DINING_VENUE_ID && v.menuId === m.id);

  const rows = useMemo(() => {
    const by = new Map<string, Row>();
    for (const g of bo.grid) {
      if (g.menuId !== m.id || g.day !== 0) continue;
      const r = bo.recipes.find((x) => x.id === g.recipeId);
      const row = by.get(g.recipeId) ?? { r, id: g.recipeId, cat: normCategory(r?.cat ?? g.cat), meals: new Set<BuilderMeal>() };
      row.meals.add(g.meal);
      by.set(g.recipeId, row);
    }
    return [...by.values()].sort((a, b) => dishLong(a.r?.name ?? '').localeCompare(dishLong(b.r?.name ?? '')));
  }, [bo.grid, bo.recipes, m.id]);

  const liveNote = live ? ' · servers see it now' : '';
  const toggle = (row: Row, ml: BuilderMeal) => {
    const on = row.meals.has(ml);
    if (on && row.meals.size === 1) {
      toast('An item needs at least one meal. Remove it instead.', { tone: 'warning' });
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
      title={everyDay ? `${m.name} · Every-day items` : m.name}
      sub={
        <span className={s.sub}>
          {everyDay ? <QuarterBadge q={m.quarter} big /> : <QuarterPick menu={m} at={now()} />}
          <StateChip state={menuState(m, venues)} />
          <span>
            {everyDay ? `À la carte items served every day alongside the ${m.name} cycle` : 'À la carte, the same every day'}
            {where.length ? ` · served at ${where.join(', ')}` : ' · not on a venue yet'}
          </span>
        </span>
      }
    >
      <button className={s.back} onClick={onBack}>
        <ChevronLeft size={16} aria-hidden /> Menu Cycle &amp; À la Carte
      </button>
      <div className={s.meals}>
        <span className={s.mealLabel}>Meal</span>
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
        {meal !== 'All' && (
          <span className={s.mealHint}>
            Showing what is offered at {meal.toLowerCase()}. Items you add go on {meal.toLowerCase()}.
          </span>
        )}
      </div>
      {live && <p className={s.liveNote}>Sequoia and Evergreen servers order from this list, so a change shows on their tablets right away.</p>}

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
                <Button size="sm" icon={<Plus size={13} />} onClick={() => setPick(ck)}>
                  Add
                </Button>
              </header>
              {!list.length && <p className={s.none}>{meal === 'All' ? 'Nothing on the menu here yet.' : `Nothing here at ${meal.toLowerCase()}.`}</p>}
              {list.map((row) => (
                <div key={row.id} className={s.row}>
                  <button className={s.name} onClick={() => row.r && setEdit(row.r)} disabled={!row.r}>
                    {row.r ? dishLong(row.r.name) : row.id}
                  </button>
                  <span className={s.chips}>
                    {MEALS.map((ml) => (
                      <button
                        key={ml}
                        aria-pressed={row.meals.has(ml)}
                        className={cx(s.mealChip, row.meals.has(ml) && s.mealOn)}
                        onClick={() => toggle(row, ml)}
                      >
                        {ml}
                      </button>
                    ))}
                  </span>
                  <button
                    className={s.remove}
                    aria-label={`Remove ${row.r?.name ?? 'item'}`}
                    onClick={() => {
                      removePlacements((g) => g.menuId === m.id && g.day === 0 && g.recipeId === row.id);
                      toast(`Removed ${dishLong(row.r?.name ?? 'item')}${liveNote}`, {
                        action: {
                          label: 'Undo',
                          onClick: () => addPlacements([...row.meals].map((ml) => ({ menuId: m.id, recipeId: row.id, day: 0, meal: ml }))),
                        },
                      });
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </section>
          );
        })}
      </div>

      {pick && (
        <RecipePicker
          title={`Add to ${m.name} · ${SECTIONS.find((x) => x[0] === pick)?.[1]}${meal !== 'All' ? ' · ' + meal : ''}`}
          cat={pick}
          onPick={(id) => add(id, pick)}
          onClose={() => setPick(null)}
        />
      )}
      {edit && <RecipeDialog recipe={edit} onClose={() => setEdit(null)} />}
    </BoPage>
  );
}
