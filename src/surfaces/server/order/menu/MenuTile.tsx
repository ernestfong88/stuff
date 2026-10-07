import { AlertTriangle, Star } from 'lucide-react';
import { serverItemName } from '../../../../domain/menu';
import type { MenuItem } from '../../../../domain/types';
import { useConfig } from '../../../../store/config';
import { useIs86 } from '../../../../store/eightySix';
import { cx } from '../../../../ui';
import s from './MenuTile.module.css';

/**
 * A menu item. The tile is the add; Mod is its own narrow target down the
 * right edge in a different colour, so it is never hit by accident.
 */
export function MenuTile({
  item,
  price,
  special,
  allergic,
  left,
  tint,
  onAdd,
  onModify,
}: {
  item: MenuItem;
  price: number;
  special: boolean;
  allergic: boolean;
  /** Portions left of a limited item, null when unlimited. */
  left: number | null;
  /** Tile [background, ink] from its group. */
  tint?: [string, string];
  onAdd: () => void;
  onModify: () => void;
}) {
  const cfg = useConfig();
  const out = useIs86(item.id);
  const soldOut = left === 0 || out;
  return (
    <div className={cx(s.tile, special && s.special, soldOut && s.soldOut)} style={!soldOut && tint ? { background: tint[0] } : undefined}>
      <button className={s.add} disabled={soldOut} onClick={onAdd} title={item.name + (item.desc ? '. ' + item.desc : '')}>
        <span className={s.name}>
          {item.special && <Star size={12} strokeWidth={2.5} className={s.star} aria-hidden />}
          {serverItemName(item.name, cfg)}
        </span>
        <span className={s.side}>
          {(price > 0 || allergic) && (
            <span className={s.price}>
              {allergic && <AlertTriangle size={11} className={s.allergy} aria-label="Allergy" />}
              {price > 0 && `$${price}`}
            </span>
          )}
          {out ? (
            <span className={s.out}>86 today</span>
          ) : (
            left != null && (
              <span className={cx(s.left, soldOut ? s.out : left <= 2 ? s.low : s.plenty)}>{soldOut ? 'Sold out' : `${left} left`}</span>
            )
          )}
        </span>
      </button>
      {!soldOut && (
        <button
          className={s.mod}
          onClick={onModify}
          title="Change how it is made before it goes on the check"
          aria-label={`Modify ${item.name}`}
        >
          Mod
        </button>
      )}
    </div>
  );
}
