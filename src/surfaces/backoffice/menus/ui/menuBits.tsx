/** Small pieces the menu pages share: quarter badges, menu state, course colours. */
import type { BoMenu } from '../../../../store/menuEdits';
import { cx } from '../../../../ui';
import { updateMenu } from '../menuActions';
import { parseQuarter, quarterOptions, quarterSeason, type MenuState } from '../model/cycle';
import { normCategory } from '../model/categories';
import { Select } from './controls';
import s from './menuBits.module.css';

export function QuarterBadge({ q, big }: { q: string; big?: boolean }) {
  const p = parseQuarter(q);
  if (!q) return <span className={cx(s.quarter, s.q0)}>No quarter</span>;
  return (
    <span className={cx(s.quarter, p ? s[`q${p.q}`] : s.q0, big && s.quarterBig)}>
      {p ? `Q${p.q} ${p.y}` : q}
      {p && <span className={s.season}>· {quarterSeason(q)}</span>}
    </span>
  );
}

/** Quarter badge with a picker to move the menu to another quarter. */
export function QuarterPick({ menu, at }: { menu: BoMenu; at: number }) {
  return (
    <span className={s.pick}>
      <QuarterBadge q={menu.quarter} big />
      <Select
        size="sm"
        value={menu.quarter}
        onChange={(quarter) => updateMenu(menu.id, { quarter })}
        options={quarterOptions(at).map((o) => ({ value: o, label: o === 'Year-round' ? o : `${o} · ${quarterSeason(o)}` }))}
        aria-label="Quarter"
      />
    </span>
  );
}

const STATE_LABEL: Record<MenuState, string> = { draft: 'Draft', scheduled: 'Scheduled', active: 'Active', archived: 'Archived' };

export function StateChip({ state }: { state: MenuState }) {
  return <span className={cx(s.state, s[`state_${state}`])}>{STATE_LABEL[state]}</span>;
}

/** Placement colours by category, the same in every builder. */
export const PLAN_LABEL: Record<string, string> = {
  Starters: 'Soup or starter',
  Entrees: 'Entrée',
  Sides: 'Side',
  Desserts: 'Dessert',
  Drinks: 'Drink',
  Snacks: 'Snack',
};

export function planClass(cat: string): string {
  return s[`plan_${normCategory(cat)}`];
}

export function PlanLegend({ note }: { note: string }) {
  return (
    <div className={s.legend}>
      {['Starters', 'Entrees', 'Sides', 'Desserts', 'Drinks'].map((k) => (
        <span key={k} className={s.legendItem}>
          <span className={cx(s.swatch, planClass(k))} />
          {PLAN_LABEL[k]}
        </span>
      ))}
      <span className={s.legendNote}>{note}</span>
    </div>
  );
}

export const swatchClass = s.swatch;
