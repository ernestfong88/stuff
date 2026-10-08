import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Plus } from 'lucide-react';
import { uid } from '../../../../lib/id';
import { navigate, useRoute } from '../../../../shell/router';
import { useConfig } from '../../../../store/config';
import type { Recipe } from '../../../../store/menuEdits';
import { Button, Tabs, cx, toast, useViewportWidth } from '../../../../ui';
import { BoPage } from '../../kit';
import { updateBo, useBo } from '../data';
import { useRecipeScores } from '../feedback';
import { GLOBAL_LIBRARY } from '../library';
import { filterCount, filterRecipes, matchesText, NO_FILTERS, presentCategories, type RecipeFilters } from '../model/recipeFilter';
import { recipeShort } from '../model/shortNames';
import { AddRecipeDialog } from './AddRecipeDialog';
import { RecipeDetail } from './RecipeDetail';
import { RecipeFiltersBar } from './RecipeFiltersBar';
import { RecipeList, type RecipeListProps } from './RecipeList';
import s from './RecipesPage.module.css';

/** From this window width the list view keeps the list beside the open recipe (as the Back Office `columns` pages). */
const SPLIT_FROM = 1500;

const open = (r: Recipe) => navigate('backoffice', ['recipes', r.id]);

/** Add a Global Library recipe: linked (Home Office keeps it up to date) or as your own copy. Returns the new id. */
function addCopy(src: Recipe, linked: boolean): string {
  const id = uid('rc');
  const copy: Recipe = { ...src, id, scope: linked ? 'linked' : 'mine', globalId: linked ? src.id : undefined };
  updateBo((st) => ({ recipes: [copy, ...st.recipes] }));
  toast(linked ? `${src.name} added. Home Office keeps it up to date.` : `${src.name} copied. It's yours to change.`, { tone: 'success' });
  return id;
}
const addLinked = (r: Recipe) => void addCopy(r, true);
const addOwnCopy = (r: Recipe) => void addCopy(r, false);

/** Recipe Book: the community's recipe master and the Home Office Global Library. */
export function RecipesPage() {
  const bo = useBo();
  const cfg = useConfig();
  const { path } = useRoute();
  const openId = path[1] ?? null;
  const [scope, setScope] = useState<'mine' | 'global'>('mine');
  const [view, setView] = useState<'list' | 'cards'>('list');
  const [f, setF] = useState<RecipeFilters>(NO_FILTERS);
  const [showAll, setShowAll] = useState(false);
  const [adding, setAdding] = useState(false);
  const scoreOf = useRecipeScores(bo.recipes);
  // A desktop screen in list view: the list on the left, the open recipe beside it.
  const split = useViewportWidth() >= SPLIT_FROM && view === 'list';
  const pane = useRef<HTMLDivElement>(null);
  const master = useRef<HTMLDivElement>(null);
  const onMenu = useMemo(() => new Set(bo.grid.map((g) => g.recipeId)), [bo.grid]);
  const pins = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of bo.modGroups) if (g.active) for (const id of g.pinned) m.set(id, (m.get(id) ?? 0) + 1);
    return m;
  }, [bo.modGroups]);
  const set = (patch: Partial<RecipeFilters>) => setF((x) => ({ ...x, ...patch }));
  // Typing stays quick: the list catches up with the search a moment later.
  const q = useDeferredValue(f.q);
  // Each recipe's short name, worked out once per recipe and config.
  const shortOf = useMemo(() => {
    const known = new WeakMap<Recipe, string>();
    return (r: Recipe) => {
      let v = known.get(r);
      if (v == null) known.set(r, (v = recipeShort(r, cfg)));
      return v;
    };
  }, [cfg]);
  const n = filterCount(f);
  const global = scope === 'global';
  const live = global || showAll || n > 0 || (split && !!openId);
  const list = useMemo(() => {
    if (global) return GLOBAL_LIBRARY.filter((r) => (!f.cat || r.cat === f.cat) && matchesText(r, q, (x) => x.name));
    return live ? filterRecipes(bo.recipes, { ...f, q }, { scoreOf, onMenu, favorites: bo.favorites, shortOf }) : [];
    // f.q is read through q, the deferred copy
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [global, live, bo.recipes, bo.favorites, f.cat, f.group, f.sub, f.protein, f.diet, f.score, f.onMenu, f.status, f.favorites, f.sort, q, scoreOf, onMenu, shortOf]);

  // A Global Library recipe you already added, linked or as a copy, so it isn't added twice.
  const ownedFrom = useCallback(
    (g: Recipe) => bo.recipes.find((x) => x.globalId === g.id || x.name.toLowerCase() === g.name.toLowerCase()),
    [bo.recipes],
  );
  const pinCount = useCallback((id: string) => pins.get(id) ?? 0, [pins]);

  const openRecipe = openId ? (bo.recipes.find((x) => x.id === openId) ?? GLOBAL_LIBRARY.find((x) => x.id === openId)) : undefined;
  const detail = openRecipe && (
    <RecipeDetail recipe={openRecipe} mine={bo.recipes.some((x) => x.id === openId)} pane={split} onBack={() => navigate('backoffice', ['recipes'])} />
  );

  // Beside the list, the picked recipe's row stays in view in the list and the recipe starts at its top
  // (below the 56px top bar), even when the page was scrolled down the last one.
  useEffect(() => {
    const el = pane.current;
    const frame = master.current?.firstElementChild;
    const row = openId ? frame?.querySelector(`[data-recipe-id="${CSS.escape(openId)}"]`) : null;
    if (frame && row) {
      const f = frame.getBoundingClientRect();
      const r = row.getBoundingClientRect();
      if (r.top < f.top + 40 || r.bottom > Math.min(f.bottom, window.innerHeight)) frame.scrollTop += r.top - f.top - 120;
      // Opened from the full list, which is gone now: keep the focus on the list so Up and Down carry on.
      if (document.activeElement === document.body) row.querySelector<HTMLElement>('button[aria-current]')?.focus({ preventScroll: true });
    }
    if (el && el.getBoundingClientRect().top < 56) el.scrollIntoView({ block: 'start' });
  }, [openId, split]);

  if (detail && !split) return detail;

  // Up and Down move through the list while it has focus.
  const onListKey = (e: KeyboardEvent) => {
    if ((e.key !== 'ArrowDown' && e.key !== 'ArrowUp') || global || !list.length || (e.target as HTMLElement).closest('input, textarea, select')) return;
    e.preventDefault();
    const i = list.findIndex((x) => x.id === openId);
    const next = list[i < 0 ? 0 : Math.min(list.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)))];
    navigate('backoffice', ['recipes', next.id], { replace: !!openId });
    const box = e.currentTarget;
    requestAnimationFrame(() => box.querySelector<HTMLElement>(`[data-recipe-id="${CSS.escape(next.id)}"] button[aria-current]`)?.focus({ preventScroll: true }));
  };

  const listProps: RecipeListProps = {
    list,
    view,
    global,
    scoreOf,
    onMenu,
    pinCount,
    onOpen: open,
    onAddLinked: addLinked,
    onCopy: addOwnCopy,
    ownedFrom,
  };
  const active = bo.recipes.filter((r) => !r.retired);
  const cnt = (c: string) => active.filter((r) => r.cat === c).length;
  const favCount = bo.recipes.filter((r) => bo.favorites[r.id]).length;
  const pick = (title: string, sub: string, onClick: () => void) => (
    <button key={title} className={s.pick} onClick={onClick}>
      <span className={s.pickTitle}>{title}</span>
      <span className={s.pickSub}>{sub}</span>
    </button>
  );

  return (
    <BoPage
      title="Recipe Book"
      actions={
        <Button variant="primary" icon={<Plus size={16} />} onClick={() => setAdding(true)}>
          Add recipe
        </Button>
      }
    >
      <div className={s.top}>
        <div className={s.scopes} role="tablist" aria-label="Recipe source">
          {(
            [
              ['mine', `My Recipes · ${bo.recipes.length}`],
              ['global', `Global Library · ${GLOBAL_LIBRARY.length}`],
            ] as const
          ).map(([k, label]) => (
            <button key={k} role="tab" aria-selected={scope === k} className={cx(s.scope, scope === k && s.scopeOn)} onClick={() => setScope(k)}>
              {label}
            </button>
          ))}
        </div>
        <Tabs
          variant="segmented"
          size="sm"
          value={view}
          onChange={setView}
          options={[
            { id: 'list', label: 'List' },
            { id: 'cards', label: 'Cards' },
          ]}
          aria-label="View"
        />
      </div>

      <RecipeFiltersBar
        f={f}
        set={set}
        categories={global ? presentCategories(GLOBAL_LIBRARY) : presentCategories(bo.recipes)}
        global={global}
        live={live}
        count={list.length}
        activeCount={n}
        showAll={showAll}
        onHide={() => setShowAll(false)}
        onClear={() => {
          setF(NO_FILTERS);
          setShowAll(false);
        }}
      />

      {global && (
        <p className={s.howTo}>
          <strong>Add</strong> keeps the recipe linked: Home Office keeps it up to date and you can't edit it. <strong>Copy to edit</strong> makes
          your own version.
        </p>
      )}
      {detail ? (
        <div className={s.split}>
          <div ref={master} className={s.master} onKeyDown={onListKey}>
            <RecipeList {...listProps} compact selectedId={openId} />
          </div>
          <div ref={pane} className={s.detail}>
            {detail}
          </div>
        </div>
      ) : live ? (
        <RecipeList {...listProps} />
      ) : (
        <section className={s.find}>
          <div>
            <h2 className={s.findTitle}>Find a recipe</h2>
            <p className={s.findSub}>Or start with one of these.</p>
          </div>
          <div className={s.picks}>
            {pick('Entrées', `${cnt('Entrees')} recipes`, () => set({ cat: 'Entrees' }))}
            {pick('Starters', `${cnt('Starters')} recipes`, () => set({ cat: 'Starters' }))}
            {pick('Sides', `${cnt('Sides')} recipes`, () => set({ cat: 'Sides' }))}
            {pick('Desserts', `${cnt('Desserts')} recipes`, () => set({ cat: 'Desserts' }))}
            {pick('★ Favorites', favCount ? `${favCount} starred` : 'None starred yet', () => set({ favorites: true }))}
            {pick('Loved by residents', 'Score 4 or higher', () => set({ score: 'love' }))}
            {pick('Needs attention', 'Score under 3', () => set({ score: 'bad' }))}
            {pick('Never scheduled', 'Not on any menu', () => set({ onMenu: 'off' }))}
          </div>
          <div>
            <button className={s.showAll} onClick={() => setShowAll(true)}>
              Show all {active.length} recipes
            </button>
          </div>
        </section>
      )}

      {adding && (
        <AddRecipeDialog
          onClose={() => setAdding(false)}
          onAddGlobal={(r, linked) => {
            const id = addCopy(r, linked);
            setAdding(false);
            navigate('backoffice', ['recipes', id]);
          }}
          onOpen={(r) => {
            setAdding(false);
            open(r);
          }}
          onCreated={(id) => {
            setAdding(false);
            navigate('backoffice', ['recipes', id]);
          }}
        />
      )}
    </BoPage>
  );
}
