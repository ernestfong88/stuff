/** Small pieces that show a recipe the same way on every page. */
import { useShared } from '../../../../lib/sharedStore';
import { menuEditsStore, type Recipe } from '../../../../store/menuEdits';
import { cx, toast } from '../../../../ui';
import { getBo, updateBo } from '../data';
import { categoryLabel, dishLong, normCategory, proteinLabel, proteinOf, subColor, subOf } from '../model/categories';
import { scoreTone, type RecipeScore } from '../model/score';
import s from './recipeBits.module.css';

/** "4.3/5 ↑" coloured by how residents like it. */
export function ScoreChip({ sc, big }: { sc: RecipeScore | null; big?: boolean }) {
  if (!sc) return <span className={s.noScore}>No score yet</span>;
  return (
    <span className={cx(s.score, s[`score_${scoreTone(sc.score)}`], big && s.scoreBig)} title="Recipe score out of 5">
      {sc.score.toFixed(1)}
      <span className={s.outOf}>/5</span>
      {sc.trend !== 'flat' && (
        <span
          title={sc.trend === 'up' ? 'Trending up in the last 3 weeks' : 'Trending down in the last 3 weeks'}
          aria-label={sc.trend === 'up' ? 'trending up' : 'trending down'}
        >
          {sc.trend === 'up' ? '↑' : '↓'}
        </span>
      )}
    </span>
  );
}

/** Category, with the subcategory and protein as chips under it. */
export function CategoryCell({ r }: { r: Recipe }) {
  const sub = subOf(r);
  const [bg, fg] = subColor(r.cat, sub);
  const protein = normCategory(r.cat) === 'Entrees' ? proteinLabel(proteinOf(r), true) : '';
  return (
    <div>
      {categoryLabel(r.cat)}
      {(sub || protein) && (
        <div className={s.chips}>
          {sub && (
            <span className={s.sub} style={{ background: bg, color: fg }}>
              {sub}
            </span>
          )}
          {protein && <span className={s.protein}>{protein}</span>}
        </div>
      )}
    </div>
  );
}

export function DietChips({ r, max = 3 }: { r: Recipe; max?: number }) {
  const f = r.dietFlags ?? [];
  if (!f.length) return <span className={s.dash}>—</span>;
  return (
    <div className={s.chips}>
      {f.slice(0, max).map((d) => (
        <span key={d} className={s.diet}>
          {d}
        </span>
      ))}
      {f.length > max && <span className={s.more}>+{f.length - max}</span>}
    </div>
  );
}

/** Star a recipe so it is easy to find again. */
export function toggleFavorite(r: Recipe): void {
  const on = !!getBo().favorites[r.id];
  updateBo((st) => {
    const next = { ...st.favorites };
    if (next[r.id]) delete next[r.id];
    else next[r.id] = true;
    return { favorites: next };
  });
  toast(on ? 'Removed from favorites' : 'Added to favorites');
}

export function FavStar({ r, onPhoto }: { r: Recipe; onPhoto?: boolean }) {
  // Just this recipe's star: a row redraws when it is starred, not on every menu edit.
  const on = useShared(menuEditsStore, (st) => !!st.favorites?.[r.id]);
  const name = dishLong(r.name);
  return (
    <button
      className={cx(s.star, on && s.starOn, onPhoto && s.starOnPhoto)}
      aria-pressed={on}
      aria-label={on ? `Remove ${name} from favorites` : `Add ${name} to favorites`}
      title={on ? 'Remove from favorites' : 'Add to favorites'}
      onClick={(e) => {
        e.stopPropagation();
        toggleFavorite(r);
      }}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {on ? '★' : '☆'}
    </button>
  );
}
