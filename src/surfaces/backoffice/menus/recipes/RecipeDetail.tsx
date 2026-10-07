import { useEffect, useRef, useState } from 'react';
import { Archive, ChevronLeft, RotateCcw } from 'lucide-react';
import { useConfig } from '../../../../store/config';
import type { Recipe } from '../../../../store/menuEdits';
import { Button, cx, toast } from '../../../../ui';
import { updateRecipe, useBo } from '../data';
import { useRecipeScores } from '../feedback';
import { autofill } from '../model/recipeDraft';
import { renameRecipe, setRecipeShort } from '../recipeActions';
import { toggleFavorite } from '../ui/recipeBits';
import { RecipeFeedback } from './RecipeFeedback';
import { RecipeForm } from './RecipeForm';
import s from './RecipeDetail.module.css';

/** How long the stand-in AI takes to draft. */
export const AI_MS = 1100;

/** Run AI Autofill on a recipe after a short "drafting" pause. */
export function useAutofill(apply: (patch: Partial<Recipe>) => void): [boolean, (r: Recipe) => void] {
  const [busy, setBusy] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return [
    busy,
    (r) => {
      setBusy(true);
      timer.current = window.setTimeout(() => {
        const { patch, filled } = autofill(r);
        if (filled.length) apply(patch);
        setBusy(false);
        toast(filled.length ? `AI drafted ${filled.join(', ')}. Review before publishing.` : 'Nothing empty to fill');
      }, AI_MS);
    },
  ];
}

/** The full recipe page. It saves as you type. */
export function RecipeDetail({ recipe, mine, onBack }: { recipe: Recipe; mine: boolean; onBack: () => void }) {
  const bo = useBo();
  const cfg = useConfig();
  const r = bo.recipes.find((x) => x.id === recipe.id) ?? recipe;
  const readOnly = !mine || r.scope === 'linked';
  const scoreOf = useRecipeScores(bo.recipes);
  const score = scoreOf(r);
  const [busy, runAi] = useAutofill((patch) => updateRecipe(r.id, patch));
  const fav = !!bo.favorites[r.id];

  return (
    <div className={s.page}>
      <div className={s.bar}>
        <button className={s.back} onClick={onBack}>
          <ChevronLeft size={16} aria-hidden /> Recipe Book
        </button>
        <span className={s.barEnd}>
          {mine && !readOnly && !r.placeholder && (
            <Button
              size="sm"
              variant={r.retired ? 'secondary' : 'softDanger'}
              icon={r.retired ? <RotateCcw size={14} /> : <Archive size={14} />}
              onClick={() => {
                const was = r.retired;
                updateRecipe(r.id, { retired: was ? undefined : true });
                toast(was ? 'Restored. It can go on menus again.' : 'Retired. It stays on menus it is already on.', {
                  tone: 'success',
                  action: { label: 'Undo', onClick: () => updateRecipe(r.id, { retired: was }) },
                });
              }}
            >
              {r.retired ? 'Restore' : 'Retire'}
            </Button>
          )}
          {mine && (
            <button className={cx(s.fav, fav && s.favOn)} aria-pressed={fav} onClick={() => toggleFavorite(r)}>
              <span aria-hidden className={s.star}>
                {fav ? '★' : '☆'}
              </span>
              {fav ? 'Favorite' : 'Add to favorites'}
            </button>
          )}
        </span>
      </div>
      <RecipeForm
        r={r}
        update={(patch) => !readOnly && updateRecipe(r.id, patch)}
        rename={(name) => !readOnly && renameRecipe(r.id, name)}
        short={cfg.shortNames[r.name] ?? ''}
        onShort={(v) => setRecipeShort(r, v)}
        readOnly={readOnly}
        global={!mine}
        page
        score={score}
        busy={busy}
        onAi={() => runAi(r)}
        onSeeFeedback={() => document.getElementById('recipe-feedback')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
      />
      <RecipeFeedback score={score} />
    </div>
  );
}
