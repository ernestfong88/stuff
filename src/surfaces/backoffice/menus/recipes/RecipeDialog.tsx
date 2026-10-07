import { useState } from 'react';
import { Archive, RotateCcw, Save } from 'lucide-react';
import { useConfig } from '../../../../store/config';
import type { Recipe } from '../../../../store/menuEdits';
import { Button, Modal, toast } from '../../../../ui';
import { updateBo, useBo } from '../data';
import { renameRecipe, setRecipeShort } from '../recipeActions';
import { toggleFavorite } from '../ui/recipeBits';
import { RecipeForm } from './RecipeForm';
import { useAutofill } from './RecipeDetail';
import s from './RecipeDialog.module.css';

/** Edit a recipe from a menu builder. It keeps a draft until Save. */
export function RecipeDialog({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  const bo = useBo();
  const cfg = useConfig();
  const [d, setD] = useState<Recipe>(recipe);
  const [short, setShort] = useState(cfg.shortNames[recipe.name] ?? '');
  const readOnly = d.scope === 'linked' || d.scope === 'global';
  const update = (patch: Partial<Recipe>) => setD((x) => ({ ...x, ...patch }));
  const [busy, runAi] = useAutofill(update);
  const fav = !!bo.favorites[recipe.id];

  const save = (patch: Partial<Recipe> = {}) => {
    const next = { ...d, ...patch, desc: d.desc || d.menuDescriptor || '' };
    if (!readOnly) {
      if (next.name !== recipe.name) renameRecipe(recipe.id, next.name);
      setRecipeShort(next, short);
    }
    updateBo((st) => ({ recipes: st.recipes.map((r) => (r.id === recipe.id ? next : r)) }));
    toast('Recipe saved', { tone: 'success' });
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit recipe"
      width={920}
      tall
      footer={
        <div className={s.footer}>
          {!recipe.placeholder &&
            (recipe.retired ? (
              <Button icon={<RotateCcw size={14} />} onClick={() => save({ retired: undefined })}>
                Restore
              </Button>
            ) : (
              <Button variant="softDanger" icon={<Archive size={14} />} onClick={() => save({ retired: true })}>
                Retire
              </Button>
            ))}
          <span className={s.spacer} />
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon={<Save size={14} />} disabled={!d.name.trim()} onClick={() => save()}>
            Save recipe
          </Button>
        </div>
      }
    >
      <div className={s.top}>
        <button className={s.fav} aria-pressed={fav} onClick={() => toggleFavorite(recipe)}>
          {fav ? '★ Favorite' : '☆ Add to favorites'}
        </button>
      </div>
      <RecipeForm
        r={d}
        update={update}
        rename={(name) => update({ name })}
        short={short}
        onShort={setShort}
        readOnly={readOnly}
        global={d.scope === 'global'}
        draft
        busy={busy}
        onAi={() => runAi(d)}
      />
    </Modal>
  );
}
