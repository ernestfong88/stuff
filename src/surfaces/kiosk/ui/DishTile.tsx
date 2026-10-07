import type { CSSProperties } from 'react';
import { Beef, ChefHat, CookingPot, Drumstick, EggFried, Fish, Pizza, Salad, Sandwich, Soup, type LucideIcon } from 'lucide-react';
import { dishPhoto } from '../../../data/photos';
import type { CatalogItem } from '../../../domain/types';
import { cx } from '../../../ui';
import { PlateGlyph } from '../../../ui/PlateGlyph';
import s from './DishTile.module.css';

/** A drawn picture of the dish's kind, so a list without photos still reads at a glance. */
export function dishIcon(it: Pick<CatalogItem, 'name' | 'etype' | 'protein'> | undefined): LucideIcon {
  const t = (it?.name ?? '').toLowerCase();
  const e = it?.etype;
  const p = it?.protein;
  if (/pizza/.test(t)) return Pizza;
  if (/omelet|egg/.test(t)) return EggFried;
  if (e === 'salad' || /salad/.test(t)) return Salad;
  if (e === 'sandwich' || /sandwich|burger|quesadilla|wrap/.test(t)) return Sandwich;
  if (e === 'pasta' || /pasta|spaghetti|shells|lasagna/.test(t)) return CookingPot;
  if (/soup|chowder|chili/.test(t)) return Soup;
  if (p === 'fish' || p === 'shellfish') return Fish;
  if (p === 'chicken' || p === 'turkey') return Drumstick;
  if (p === 'beef') return Beef;
  return ChefHat;
}

/** Square tile: the dish's photo, or its kind drawn on a pale square. `size` is in kiosk units. */
export function DishTile({ item, size = 96 }: { item: CatalogItem | undefined; size?: number }) {
  const photo = dishPhoto(item?.name);
  const style = { '--size': size } as CSSProperties;
  if (photo) return <img className={s.tile} style={style} src={photo} alt="" draggable={false} />;
  const Icon = dishIcon(item);
  return (
    <span className={cx(s.tile, s.drawn)} style={style} aria-hidden>
      <Icon size="52%" strokeWidth={1.7} />
    </span>
  );
}

/** A wide picture for a special: the photo, or a drawn place setting. */
export function DishPicture({ item, className }: { item: CatalogItem | undefined; className?: string }) {
  const photo = dishPhoto(item?.name, true);
  if (photo) return <img className={cx(s.picture, className)} src={photo} alt="" draggable={false} />;
  return (
    <span className={cx(s.picture, s.pictureDrawn, className)} aria-hidden>
      <PlateGlyph className={s.plate} />
    </span>
  );
}
