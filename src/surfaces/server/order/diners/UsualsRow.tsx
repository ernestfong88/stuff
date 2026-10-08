import { useMemo } from 'react';
import { isDrink, serverItemName } from '../../../../domain/menu';
import { learnedFavorites } from '../../../../domain/orders';
import type { Diner, MealName, Resident } from '../../../../domain/types';
import { useConfig } from '../../../../store/config';
import { useDiningHistory } from '../../../../store/dining';
import { use86, is86 } from '../../../../store/eightySix';
import { cx } from '../../../../ui';
import s from './UsualsRow.module.css';
import { usualsFor, type Usual } from './usuals';

/** "Usual dinner · tap to add": shown until the diner has food on the check. */
export function UsualsRow({
  diner,
  resident,
  meal,
  onAdd,
}: {
  diner: Diner;
  resident: Resident;
  meal: MealName;
  onAdd: (u: Usual) => void;
}) {
  const cfg = useConfig();
  const history = useDiningHistory();
  const marks = use86();
  const hasDrink = diner.items.some((l) => !l.cancelled && isDrink(l.itemId));
  const learned = useMemo(() => learnedFavorites(history, resident.id, meal), [history, resident.id, meal]);
  const u = usualsFor(resident, meal, learned);
  const list = [...(hasDrink ? [] : u.drinks.map((x) => ({ ...x, drink: true }))), ...u.food.map((x) => ({ ...x, drink: false }))].filter(
    (x) => !is86(marks, x.item.id),
  );
  if (!list.length) return null;
  return (
    <div className={cx(s.row, 'fade-in')}>
      <span className={s.label}>Usual {meal.toLowerCase()} · tap to add</span>
      {list.map((x) => (
        <button
          key={x.item.id}
          className={cx(s.chip, x.drink && s.drink)}
          onClick={(e) => {
            e.stopPropagation();
            onAdd(x);
          }}
        >
          {serverItemName(x.item.name, cfg)}
          {x.n != null && x.n > 1 && <span className={s.n}>×{x.n}</span>}
        </button>
      ))}
    </div>
  );
}
