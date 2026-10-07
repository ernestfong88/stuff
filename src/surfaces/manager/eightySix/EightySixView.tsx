import { useState } from 'react';
import { getItem, menu } from '../../../data';
import { serverItemName } from '../../../domain/menu';
import type { MealName, MenuItem } from '../../../domain/types';
import { today } from '../../../lib/clock';
import { useConfig } from '../../../store/config';
import { is86, itemsOut, set86, use86 } from '../../../store/eightySix';
import { EmptyState, PageTitle, SearchField, Tabs, cx } from '../../../ui';
import { MEALS } from '../metrics/stepsOfService';
import s from './EightySixView.module.css';

/** Day of the menu cycle being served; items with day 0 are on every day. */
export const MENU_CYCLE_DAY = 15;

/** __kMealNow: the meal the clock is in. */
export function mealByHour(hour: number): MealName {
  return hour >= 15 ? 'Dinner' : hour >= 10 ? 'Lunch' : 'Breakfast';
}

/** Today's items of a meal by category, each item once, matching the search. */
export function menuForToday(meal: MealName, query: string): Array<[string, MenuItem[]]> {
  const seen = new Set<string>();
  const q = query.trim().toLowerCase();
  return Object.entries(menu[meal] ?? {})
    .map(([cat, items]): [string, MenuItem[]] => [
      cat,
      items.filter((it) => {
        if (!(it.day == null || it.day === 0 || it.day === MENU_CYCLE_DAY) || seen.has(it.id)) return false;
        seen.add(it.id);
        return !q || it.name.toLowerCase().includes(q);
      }),
    ])
    .filter(([, items]) => items.length > 0);
}

/** __KMgr86: mark what the kitchen is out of; it comes back on its own at midnight. */
export function EightySixView() {
  const marks = use86();
  const cfg = useConfig();
  const [meal, setMeal] = useState<MealName>(() => mealByHour(today().getHours()));
  const [q, setQ] = useState('');
  const out = itemsOut(marks)
    .map((id) => getItem(id))
    .filter((it): it is NonNullable<typeof it> => !!it);
  const cats = menuForToday(meal, q);
  const short = (name: string) => serverItemName(name, cfg);

  return (
    <div className={s.scroll}>
      <PageTitle sub="Mark what the kitchen is out of. It greys out on every tablet right away and comes back on its own at midnight.">86 list</PageTitle>

      <section className={s.outBox} aria-live="polite">
        <div className={cx(s.outTitle, out.length > 0 && s.outTitleOn)}>{out.length ? `Out today · ${out.length}` : 'Nothing is 86 today'}</div>
        {out.length > 0 && (
          <div className={s.outList}>
            {out.map((it) => (
              <button key={it.id} className={s.outChip} onClick={() => set86(it.id, false)} title="Put it back on the menu">
                {short(it.name)}
                <span className={s.backOn}>Back on</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <div className={s.filters}>
        <Tabs<MealName> variant="pills" size="md" value={meal} onChange={setMeal} aria-label="Meal" options={MEALS.map((m) => ({ id: m, label: m }))} />
        <span className={s.grow} />
        <SearchField value={q} onChange={setQ} placeholder="Search the menu" className={s.search} />
      </div>

      {cats.length ? (
        cats.map(([cat, items]) => (
          <section key={cat} className={s.cat}>
            <h3 className={s.catTitle}>{cat}</h3>
            <div className={s.grid}>
              {items.map((it) => {
                const on = is86(marks, it.id);
                return (
                  <button key={it.id} className={cx(s.item, on && s.itemOut)} onClick={() => set86(it.id, !on)} aria-pressed={on}>
                    <span className={s.itemName}>{short(it.name)}</span>
                    <span className={s.mark}>{on ? '86' : 'Mark 86'}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ))
      ) : (
        <EmptyState compact title={`Nothing on the ${meal.toLowerCase()} menu matches.`} />
      )}
    </div>
  );
}
