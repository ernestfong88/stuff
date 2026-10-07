import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Chip, Modal, SearchField, cx } from '../../../../ui';
import { useBo } from '../data';
import { dishLong, normCategory } from '../model/categories';
import { PLAN_LABEL, planClass, swatchClass } from '../ui/menuBits';
import { AiRecipeDialog } from './AiRecipeDialog';
import s from './RecipePicker.module.css';

const CATS = ['All', 'Starters', 'Entrees', 'Sides', 'Desserts', 'Drinks'];

/**
 * Pick a recipe from the master to place on a menu. When the dish is not
 * in the master yet, AI Assist drafts it from a few answers.
 */
export function RecipePicker({
  title,
  cat,
  placeholder,
  onPick,
  onClose,
}: {
  title: string;
  cat?: string | null;
  placeholder?: string;
  onPick: (recipeId: string) => void;
  onClose: () => void;
}) {
  const bo = useBo();
  const [q, setQ] = useState('');
  const [c, setC] = useState(cat && CATS.includes(cat) ? cat : 'All');
  const [ai, setAi] = useState(false);
  const query = q.trim().toLowerCase();
  const list = bo.recipes
    .filter(
      (r) =>
        !r.retired &&
        (c === 'All' || normCategory(r.cat) === c) &&
        (!query || r.name.toLowerCase().includes(query) || dishLong(r.name).toLowerCase().includes(query)),
    )
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 40);
  const exact = bo.recipes.some((r) => r.name.toLowerCase() === query);

  if (ai) {
    return (
      <AiRecipeDialog
        name={q.trim()}
        cat={c === 'All' ? undefined : c}
        onClose={() => setAi(false)}
        onCreated={(id) => {
          onPick(id);
          onClose();
        }}
      />
    );
  }

  return (
    <Modal open onClose={onClose} title={title} width={560}>
      <SearchField value={q} onChange={setQ} placeholder={placeholder ?? 'Search the recipe master'} autoFocus />
      <div className={s.cats} role="radiogroup" aria-label="Category">
        {CATS.map((k) => (
          <button key={k} role="radio" aria-checked={c === k} className={cx(s.cat, k !== 'All' && planClass(k), c === k && s.catOn)} onClick={() => setC(k)}>
            {k === 'All' ? 'All' : PLAN_LABEL[k]}
          </button>
        ))}
      </div>
      <div className={s.list}>
        {list.map((r) => (
          <button
            key={r.id}
            className={s.item}
            onClick={() => {
              onPick(r.id);
              onClose();
            }}
          >
            <span className={cx(swatchClass, planClass(r.cat))} />
            <span className={s.itemName}>{dishLong(r.name)}</span>
            <span className={s.itemCat}>{r.cat}</span>
          </button>
        ))}
        {!list.length && <div className={s.none}>Nothing matches. Try another word or category.</div>}
      </div>
      {query.length > 1 && !exact && (
        <button className={s.ai} onClick={() => setAi(true)}>
          <Sparkles size={16} aria-hidden className={s.aiIcon} />
          <span className={s.aiText}>
            <span className={s.aiTitle}>AI Assist: create “{q.trim()}”</span>
            <span className={s.aiSub}>{list.length ? 'Not one of these? ' : 'Not in your recipes yet. '}Answer a few questions and AI drafts the recipe.</span>
          </span>
          <Chip tone="info">New recipe</Chip>
        </button>
      )}
    </Modal>
  );
}
