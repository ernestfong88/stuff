import { SearchField, Tabs, cx } from '../../../../ui';
import { DIETS, PROTEINS, subcategories, subcategoryGroups } from '../model/categories';
import type { RecipeFilters, RecipeSort, ScoreFilter, StatusFilter } from '../model/recipeFilter';
import { Field, Select } from '../ui/controls';
import s from './RecipeFiltersBar.module.css';

const SCORES: Array<{ value: ScoreFilter; label: string }> = [
  { value: 'love', label: 'Loved, 4 or higher' },
  { value: 'ok', label: 'Okay, 3 to 3.9' },
  { value: 'bad', label: 'Needs attention, under 3' },
  { value: 'none', label: 'No score yet' },
];

/** Search, category and the finer filters above the recipe list. */
export function RecipeFiltersBar({
  f,
  set,
  categories,
  global,
  live,
  count,
  activeCount,
  showAll,
  onHide,
  onClear,
}: {
  f: RecipeFilters;
  set: (patch: Partial<RecipeFilters>) => void;
  categories: string[];
  global: boolean;
  live: boolean;
  count: number;
  activeCount: number;
  showAll: boolean;
  onHide: () => void;
  onClear: () => void;
}) {
  // Named subcategory groups (Drinks: Non-Alcoholic / Alcoholic) get their own choice; the subcategories then follow it.
  const groups = f.cat ? subcategoryGroups(f.cat).filter(([name]) => name) : [];
  const subs = f.cat ? (f.group ? (groups.find(([g]) => g === f.group)?.[1] ?? []) : subcategories(f.cat)) : [];
  return (
    <section className={s.card} aria-label="Filters">
      <div className={s.row}>
        <Field label="Search">
          <SearchField value={f.q} onChange={(q) => set({ q })} placeholder="Name, short name or description" className={s.search} />
        </Field>
        <Field label="Category">
          <Tabs
            variant="segmented"
            size="sm"
            value={f.cat || 'All'}
            onChange={(c) => set({ cat: c === 'All' ? '' : c, group: '', sub: '', ...(c !== 'All' && c !== 'Entrees' ? { protein: '' } : {}) })}
            options={['All', ...categories].map((c) => ({ id: c, label: c === 'Entrees' ? 'Entrées' : c }))}
            aria-label="Category"
          />
        </Field>
      </div>
      {!global && (
        <div className={s.row}>
          {groups.length > 0 && (
            <Field label="Type">
              <Tabs
                variant="segmented"
                size="sm"
                value={f.group || 'Any'}
                onChange={(g) => set({ group: g === 'Any' ? '' : g, sub: '' })}
                options={['Any', ...groups.map(([g]) => g)].map((g) => ({
                  id: g,
                  label: g === 'Any' ? 'Any' : g.charAt(0) + g.slice(1).toLowerCase(),
                }))}
                aria-label="Type"
              />
            </Field>
          )}
          {subs.length > 0 && (
            <Field label="Subcategory">
              <Select
                size="sm"
                emphasize
                value={f.sub}
                onChange={(sub) => set({ sub })}
                placeholder={'Any ' + (f.group ? f.group.toLowerCase() + ' ' : '') + f.cat.toLowerCase()}
                options={subs.map((x) => ({ value: x, label: x }))}
              />
            </Field>
          )}
          {(!f.cat || f.cat === 'Entrees') && (
            <Field label="Protein">
              <Select
                size="sm"
                emphasize
                value={f.protein}
                onChange={(protein) => set({ protein })}
                placeholder="Any protein"
                options={PROTEINS.map((p) => ({ value: p.id, label: p.label }))}
              />
            </Field>
          )}
          <Field label="Diet">
            <Select
              size="sm"
              emphasize
              value={f.diet}
              onChange={(diet) => set({ diet })}
              placeholder="Any diet"
              options={DIETS.map((d) => ({ value: d, label: d }))}
            />
          </Field>
          <Field label="Resident score">
            <Select size="sm" emphasize value={f.score} onChange={(v) => set({ score: v as ScoreFilter })} placeholder="Any score" options={SCORES} />
          </Field>
          <Field label="Menus">
            <Select
              size="sm"
              emphasize
              value={f.onMenu}
              onChange={(v) => set({ onMenu: v as RecipeFilters['onMenu'] })}
              placeholder="On a menu or not"
              options={[
                { value: 'on', label: 'On a menu' },
                { value: 'off', label: 'Never scheduled' },
              ]}
            />
          </Field>
        </div>
      )}
      <div className={s.foot}>
        {live ? (
          <span>
            <b className={s.count}>{count}</b> {count === 1 ? 'recipe' : 'recipes'}
          </span>
        ) : null}
        {showAll && activeCount === 0 && (
          <button className={s.link} onClick={onHide}>
            Hide list
          </button>
        )}
        {activeCount > 0 && (
          <button className={s.link} onClick={onClear}>
            Clear filters
          </button>
        )}
        {!global && (
          <span className={s.right}>
            <Tabs
              variant="segmented"
              size="sm"
              value={f.status}
              onChange={(v: StatusFilter) => set({ status: v })}
              options={[
                { id: 'active', label: 'Active' },
                { id: 'retired', label: 'Retired' },
                { id: 'all', label: 'All' },
              ]}
              aria-label="Status"
            />
            <button className={cx(s.fav, f.favorites && s.favOn)} aria-pressed={f.favorites} onClick={() => set({ favorites: !f.favorites })}>
              <span className={s.favStar} aria-hidden>
                {f.favorites ? '★' : '☆'}
              </span>
              Favorites
            </button>
            <span className={s.sort}>
              <span className={s.sortLabel}>Sort</span>
              <Select
                size="sm"
                value={f.sort === 'name' ? '' : f.sort}
                onChange={(v) => set({ sort: (v || 'name') as RecipeSort })}
                placeholder="Name, A to Z"
                options={[
                  { value: 'hi', label: 'Score, high to low' },
                  { value: 'lo', label: 'Score, low to high' },
                  { value: 'sold', label: 'Most sold' },
                ]}
                aria-label="Sort"
              />
            </span>
          </span>
        )}
      </div>
    </section>
  );
}
