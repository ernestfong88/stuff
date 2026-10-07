import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { uid } from '../../../../lib/id';
import { navigate, useRoute } from '../../../../shell/router';
import { useConfig } from '../../../../store/config';
import type { Recipe } from '../../../../store/menuEdits';
import { Button, Tabs, cx, toast } from '../../../../ui';
import { BoPage } from '../../kit';
import { updateBo, useBo } from '../data';
import { useRecipeScores } from '../feedback';
import { GLOBAL_LIBRARY } from '../library';
import { filterCount, filterRecipes, matchesText, NO_FILTERS, presentCategories, type RecipeFilters } from '../model/recipeFilter';
import { recipeShort } from '../model/shortNames';
import { AddRecipeDialog } from './AddRecipeDialog';
import { RecipeDetail } from './RecipeDetail';
import { RecipeFiltersBar } from './RecipeFiltersBar';
import { RecipeList } from './RecipeList';
import s from './RecipesPage.module.css';

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
  const onMenu = useMemo(() => new Set(bo.grid.map((g) => g.recipeId)), [bo.grid]);
  const pins = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of bo.modGroups) if (g.active) for (const id of g.pinned) m.set(id, (m.get(id) ?? 0) + 1);
    return m;
  }, [bo.modGroups]);
  const set = (patch: Partial<RecipeFilters>) => setF((x) => ({ ...x, ...patch }));
  const n = filterCount(f);
  const global = scope === 'global';
  const live = global || showAll || n > 0;
  const list = useMemo(() => {
    if (global) return GLOBAL_LIBRARY.filter((r) => (!f.cat || r.cat === f.cat) && matchesText(r, f.q, (x) => x.name));
    return live ? filterRecipes(bo.recipes, f, { scoreOf, onMenu, favorites: bo.favorites, shortOf: (r) => recipeShort(r, cfg) }) : [];
  }, [global, live, bo.recipes, bo.favorites, f, scoreOf, onMenu, cfg]);

  const open = (r: Recipe) => navigate('backoffice', ['recipes', r.id]);
  // A Global Library recipe you already added, linked or as a copy, so it isn't added twice.
  const ownedFrom = (g: Recipe) => bo.recipes.find((x) => x.globalId === g.id || x.name.toLowerCase() === g.name.toLowerCase());
  const addCopy = (src: Recipe, linked: boolean) => {
    const id = uid('rc');
    const copy: Recipe = { ...src, id, scope: linked ? 'linked' : 'mine', globalId: linked ? src.id : undefined };
    updateBo((st) => ({ recipes: [copy, ...st.recipes] }));
    toast(linked ? `${src.name} added. Home Office keeps it up to date.` : `${src.name} copied. It's yours to change.`, { tone: 'success' });
    return id;
  };

  if (openId) {
    const r = bo.recipes.find((x) => x.id === openId) ?? GLOBAL_LIBRARY.find((x) => x.id === openId);
    if (r) return <RecipeDetail recipe={r} mine={bo.recipes.some((x) => x.id === openId)} onBack={() => navigate('backoffice', ['recipes'])} />;
  }

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
      {live ? (
        <RecipeList
          list={list}
          view={view}
          global={global}
          scoreOf={scoreOf}
          onMenu={onMenu}
          pinCount={(id) => pins.get(id) ?? 0}
          onOpen={open}
          onAddLinked={(r) => addCopy(r, true)}
          onCopy={(r) => addCopy(r, false)}
          ownedFrom={ownedFrom}
        />
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
