import { ListChecks } from 'lucide-react';
import type { AlcCount, StandardLevel } from '../model/alcStandards';
import { standardLevel } from '../model/alcStandards';
import { cx } from '../../../../ui';
import s from './AlcCounter.module.css';

export const ALC_RULE = "Beverages and upcharges don't count; sides count toward the 20.";

/** "Menu items 17 / 20 · Sides 6 / 8": amber at the limit, red over it. */
export function AlcCounter({ count: c }: { count: AlcCount }) {
  const items = standardLevel(c.items, c.limitItems);
  const sides = standardLevel(c.sides, c.limitSides);
  const rule = `Menu standard: up to ${c.limitItems} menu items, at most ${c.limitSides} of them sides. ${ALC_RULE.replace('the 20', `the ${c.limitItems}`)}`;
  return (
    <span
      className={cx(s.counter, items === 'over' || sides === 'over' ? s.counterOver : (items === 'at' || sides === 'at') && s.counterAt)}
      title={rule}
      aria-label={`Menu items ${c.items} of ${c.limitItems}, sides ${c.sides} of ${c.limitSides}. ${rule}`}
    >
      <ListChecks size={14} aria-hidden className={s.icon} />
      <Part label="Menu items" n={c.items} limit={c.limitItems} level={items} />
      <span className={s.dot} aria-hidden>
        ·
      </span>
      <Part label="Sides" n={c.sides} limit={c.limitSides} level={sides} />
    </span>
  );
}

function Part({ label, n, limit, level }: { label: string; n: number; limit: number; level: StandardLevel }) {
  return (
    <span className={cx(s.part, s[level])} data-level={level}>
      <span className={s.label}>{label}</span>
      <b className={s.num}>
        {n} / {limit}
      </b>
    </span>
  );
}

/** How much a menu is over the standard ("45 menu items", "4 sides"); empty when it is not. */
export function alcWarnings(c: AlcCount): string[] {
  const out: string[] = [];
  const items = c.items - c.limitItems;
  const sides = c.sides - c.limitSides;
  if (items > 0) out.push(`${items} menu ${items === 1 ? 'item' : 'items'}`);
  if (sides > 0) out.push(`${sides} ${sides === 1 ? 'side' : 'sides'}`);
  return out;
}
