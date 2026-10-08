import { useState } from 'react';
import { useMenuVersion } from '../../data';
import { MEALS, mealAt } from '../../domain/mealPeriods';
import type { MealName, MenuItem } from '../../domain/types';
import { now } from '../../lib/clock';
import { useVenue } from '../../shell/session';
import { is86, use86 } from '../../store/eightySix';
import { venueName } from '../../store/sideWork';
import { Modal, Tabs, cx } from '../../ui';
import { DishView } from '../server/features/menu/DishView';
import { menuSections } from '../server/features/menu/menuSections';
import { DishPicture } from './DishPicture';
import s from './MenuReference.module.css';

/** Specials, then each category; the cook line sees entrées only, all under one heading. */
function kitchenSections(meal: MealName, room: string, entreesOnly: boolean) {
  const { specials, categories } = menuSections(meal, room);
  const keep = (it: MenuItem) => !entreesOnly || !!it.entree;
  const groups: Array<{ category: string; items: MenuItem[] }> = [];
  for (const c of categories) {
    const category = entreesOnly || /^specials?$/i.test(c.name) ? 'Entrées' : c.name;
    for (const item of c.items.filter(keep)) {
      const g = groups.find((x) => x.category === category);
      if (g) g.items.push(item);
      else groups.push({ category, items: [item] });
    }
  }
  return { specials: specials.filter(keep), groups };
}

/**
 * Today's menu for the kitchen: what each dish is plated with, its cook
 * notes, choices and allergens. The cook line sees entrees only.
 */
export function MenuReference({ open, onClose, entreesOnly }: { open: boolean; onClose: () => void; entreesOnly?: boolean }) {
  const [meal, setMeal] = useState<MealName>(() => mealAt(now()));
  const [dish, setDish] = useState<MenuItem | null>(null);
  // Cook and Expo keep this mounted, so each opening starts on the meal being served then.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setMeal(mealAt(now()));
  }
  const marks = use86();
  const [venue] = useVenue();
  useMenuVersion();
  const { specials, groups } = open ? kitchenSections(meal, venue, !!entreesOnly) : { specials: [], groups: [] };
  const out = (it: MenuItem) => is86(marks, it.id);

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        tall
        width={780}
        title={`Today's menu · ${venueName(venue)}`}
        subtitle={
          entreesOnly
            ? 'Entrées only: today’s specials, then every day. Tap one for the plating and cook notes.'
            : 'Specials first. Tap a dish to see it full screen with the plating and cook notes.'
        }
      >
        <Tabs
          aria-label="Meal"
          value={meal}
          onChange={setMeal}
          options={MEALS.map((m) => ({ id: m, label: m }))}
          className={s.tabs}
        />
        {specials.length > 0 && (
          <section>
            <h3 className={cx(s.head, s.headSpecial)}>Today&apos;s specials · {specials.length}</h3>
            <div className={s.cards}>
              {specials.map((it) => (
                <button key={it.id} className={s.card} onClick={() => setDish(it)}>
                  <DishPicture name={it.name} size="card" />
                  <span className={s.cardText}>
                    <span className={s.nameRow}>
                      <span className={cx(s.name, out(it) && s.out)}>{it.name}</span>
                      {out(it) && <span className={s.badge86}>86</span>}
                    </span>
                    {it.desc && <span className={s.cardDesc}>{it.desc}</span>}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}
        {groups.map((g) => (
          <section key={g.category}>
            <h3 className={s.head}>
              {g.category} · {g.items.length}
            </h3>
            <div className={s.list}>
              {g.items.map((it) => (
                <button key={it.id} className={s.row} onClick={() => setDish(it)}>
                  <DishPicture name={it.name} />
                  <span className={s.rowText}>
                    <span className={cx(s.name, out(it) && s.out)}>{it.name}</span>
                    {it.desc && <span className={s.rowDesc}>{it.desc}</span>}
                  </span>
                  {out(it) && <span className={s.badge86}>86</span>}
                  <span className={s.view}>View</span>
                </button>
              ))}
            </div>
          </section>
        ))}
        {!specials.length && !groups.length && <p className={s.none}>Nothing on the {meal.toLowerCase()} menu today.</p>}
      </Modal>
      {dish && <DishView item={dish} out={out(dish)} cookNotes onClose={() => setDish(null)} />}
    </>
  );
}
