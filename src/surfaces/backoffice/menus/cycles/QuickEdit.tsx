import { useState } from 'react';
import { X } from 'lucide-react';
import { useConfig } from '../../../../store/config';
import type { Recipe } from '../../../../store/menuEdits';
import { Button, Modal, toast } from '../../../../ui';
import { placementSides, setPlacementSides, useBo } from '../data';
import { normCategory } from '../model/categories';
import { recipeShort } from '../model/shortNames';
import { tabletIds, tabletIndex, tabletItem } from '../model/tablet';
import { renameRecipe } from '../recipeActions';
import { Input, Select } from '../ui/controls';
import s from './QuickEdit.module.css';

/** Add-ons (extra protein and the like) are sold on their own, never a default side. */
const isAddOn = (id: string) => tabletIds(id).some((t) => tabletIndex().placeOf.get(t)?.category === 'Add-Ons');

/**
 * Quick edit from the menu builder: this week's catch for a Catch of the
 * Day, and the default sides this placement comes with.
 */
export function QuickEdit({
  menuId,
  day,
  recipe,
  onClose,
  onFull,
}: {
  menuId: string;
  day: number;
  recipe: Recipe;
  onClose: () => void;
  onFull: () => void;
}) {
  const bo = useBo();
  const cfg = useConfig();
  const r = bo.recipes.find((x) => x.id === recipe.id) ?? recipe;
  const cod = /^COD\b/.test(r.name);
  const [fish, setFish] = useState(cod ? r.name.replace(/^COD\s*·?\s*/, '') : '');
  const entree = normCategory(r.cat) === 'Entrees';
  const { sides, changed } = placementSides(bo, menuId, day, r.id);
  const nameOf = (id: string) => bo.recipes.find((x) => x.id === id)?.name ?? tabletItem(id)?.name ?? id;
  const options = bo.recipes
    .filter((x) => normCategory(x.cat) === 'Sides' && !x.retired && !sides.includes(x.id) && !isAddOn(x.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  const short = recipeShort(r, cfg);
  const newName = fish.trim() ? 'COD · ' + fish.trim().charAt(0).toUpperCase() + fish.trim().slice(1) : '';
  const rename = () => {
    if (!newName || newName === r.name) return;
    renameRecipe(r.id, newName);
    toast(`Servers and the cook line now see ${newName}`, { tone: 'success' });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={r.name}
      width={480}
      footer={
        <>
          <Button variant="ghost" onClick={onFull}>
            Open full recipe
          </Button>
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
      <div className={s.body}>
        <p className={s.info}>
          {r.cat} · {day ? `Day ${day} of this menu` : 'Any Day on this menu'}
          {short !== r.name ? ` · servers see ${short}` : ''}
        </p>
        {cod && (
          <div>
            <div className={s.label}>This week&apos;s fish</div>
            <div className={s.fishRow}>
              <span className={s.cod}>COD ·</span>
              <Input
                size="sm"
                value={fish}
                placeholder="e.g. Salmon"
                aria-label="This week's fish"
                onChange={(e) => setFish(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && rename()}
                className={s.fishIn}
              />
              <Button size="sm" variant="primary" disabled={!newName || newName.toLowerCase() === r.name.toLowerCase()} onClick={rename}>
                Rename
              </Button>
            </div>
            <p className={s.note}>Servers, the cook line and Expo see the new name right away.</p>
          </div>
        )}
        {entree ? (
          <div>
            <div className={s.label}>{day ? `Default sides on Day ${day}` : 'Default sides on this menu'}</div>
            <div className={s.sides}>
              {sides.map((id) => (
                <span key={id} className={s.side}>
                  {nameOf(id)}
                  <button
                    aria-label={`Remove ${nameOf(id)}`}
                    onClick={() =>
                      setPlacementSides(
                        menuId,
                        day,
                        r.id,
                        sides.filter((x) => x !== id),
                      )
                    }
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
              {!sides.length && <span className={s.muted}>No default side</span>}
              <Select
                size="sm"
                value=""
                onChange={(v) => v && setPlacementSides(menuId, day, r.id, [...sides, v])}
                placeholder="+ Add a default side"
                options={options.map((x) => ({ value: x.id, label: x.name }))}
                aria-label="Add a default side"
              />
            </div>
            <p className={s.note}>
              {day ? `Only this special on Day ${day} uses these. ` : 'The same entrée on another menu keeps its own. '}
              Servers can remove or swap a default side for free.
            </p>
            {changed && (
              <button className={s.link} onClick={() => setPlacementSides(menuId, day, r.id, null)}>
                Go back to the usual default
              </button>
            )}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
