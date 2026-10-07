import { useState } from 'react';
import { getItem } from '../../../data';
import { serverItemName } from '../../../domain/menu';
import type { MealName } from '../../../domain/types';
import { today } from '../../../lib/clock';
import { useConfig } from '../../../store/config';
import { is86, itemsOut, set86, use86 } from '../../../store/eightySix';
import { EmptyState, PageTitle, SearchField, Tabs, cx, toast } from '../../../ui';
import { MEALS } from '../../../domain/metrics/stepsOfService';
import { mealByHour, menuForToday } from './menuToday';
import s from './EightySixView.module.css';

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
  /** Every tablet sees the change at once, so each tap says what it did and can be undone. */
  const mark = (id: string, name: string, out: boolean) => {
    set86(id, out);
    toast(out ? `${short(name)} is 86 on every tablet` : `${short(name)} is back on the menu`, {
      tone: out ? undefined : 'success',
      action: { label: 'Undo', onClick: () => set86(id, !out) },
    });
  };

  return (
    <div className={s.scroll}>
      <PageTitle sub="Mark what the kitchen is out of. It greys out on every tablet right away and comes back on its own at midnight.">86 list</PageTitle>

      <section className={s.outBox} aria-live="polite">
        <div className={cx(s.outTitle, out.length > 0 && s.outTitleOn)}>{out.length ? `Out today · ${out.length}` : 'Nothing is 86 today'}</div>
        {out.length > 0 && (
          <div className={s.outList}>
            {out.map((it) => (
              <button key={it.id} className={s.outChip} onClick={() => mark(it.id, it.name, false)} aria-label={`Put ${short(it.name)} back on the menu`}>
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
                  <button key={it.id} className={cx(s.item, on && s.itemOut)} onClick={() => mark(it.id, it.name, !on)} aria-pressed={on}>
                    <span className={s.itemName}>{short(it.name)}</span>
                    <span className={s.mark}>{on ? 'Put back on' : 'Mark 86'}</span>
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
