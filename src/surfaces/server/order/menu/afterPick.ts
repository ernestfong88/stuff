/**
 * Taking the order is all about speed. After an item is rung in, the check
 * moves on by itself:
 *   - an entrée that comes without a side opens Sides for the same diner,
 *     and picking a side moves on (a side is never required);
 *   - an entrée finishes a diner's order, so the next diner opens on Starters;
 *   - when the table is ordering dessert after the meal, a dessert finishes
 *     that diner too.
 * The last diner stays put.
 */
import { getItem } from '../../../../data';
import { DEFAULT_CONFIG, flag, type DiningConfig } from '../../../../domain/config';
import { defaultSides, isDrink, isSide } from '../../../../domain/menu';
import type { Order } from '../../../../domain/types';
import { isDessert, isMain, orderMenuDate, orderMenuRoom, type MenuTab } from './menuCatalog';

/** __kNeedsSide: no default side and no Sides choice on the item itself. */
export function needsSide(itemId: string): boolean {
  return !defaultSides(itemId).length && !(getItem(itemId)?.mods ?? []).some((g) => /^sides?$/i.test(g.group || ''));
}

export interface AfterPick {
  /** The diner whose entrée is waiting on an optional side, if any. */
  sideWait: string | null;
  /** Switch the menu to this tab. */
  tab?: MenuTab;
  /** Select this diner. */
  diner?: string;
}

export function afterPick(
  o: Order,
  dinerId: string,
  itemId: string,
  sideWait: string | null,
  tabs: MenuTab[],
  cfg: DiningConfig = DEFAULT_CONFIG,
): AfterPick {
  const i = o.diners.findIndex((d) => d.id === dinerId);
  const next = i >= 0 ? o.diners[i + 1] : undefined;
  const moveOn = (wait: string | null): AfterPick => ({
    sideWait: wait,
    diner: next?.id,
    tab: tabs.includes('Starters') ? 'Starters' : undefined,
  });
  let wait = sideWait && (sideWait !== dinerId || !isSide(itemId)) ? null : sideWait;
  if (isMain(o.meal, itemId, orderMenuRoom(o), orderMenuDate(o)) && needsSide(itemId) && tabs.includes('Sides'))
    return { sideWait: dinerId, tab: 'Sides' };
  if (wait === dinerId && isSide(itemId)) {
    wait = null;
    return next && flag(cfg, 'entreeNext') ? moveOn(null) : { sideWait: null };
  }
  if (!next) return { sideWait: wait };
  if (flag(cfg, 'entreeNext') && isMain(o.meal, itemId, orderMenuRoom(o), orderMenuDate(o))) return moveOn(wait);
  const ateAlready = o.diners.some((d) => d.items.some((l) => l.sent && !l.cancelled && !isDrink(l.itemId)));
  if (flag(cfg, 'dessertNext') && isDessert(o.meal, itemId, orderMenuRoom(o), orderMenuDate(o)) && ateAlready)
    return { sideWait: wait, diner: next.id };
  return { sideWait: wait };
}
