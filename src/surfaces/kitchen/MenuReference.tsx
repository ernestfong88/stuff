import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getItem, meals, menu } from '../../data';
import { defaultSides, isDrink } from '../../domain/menu';
import type { MealName, MenuItem } from '../../domain/types';
import { today } from '../../lib/clock';
import { is86, use86 } from '../../store/eightySix';
import { Modal, Tabs, cx } from '../../ui';
import { DishPicture } from './DishPicture';
import s from './MenuReference.module.css';

function mealNow(): MealName {
  const h = today().getHours();
  return h >= 15 ? 'Dinner' : h >= 10 ? 'Lunch' : 'Breakfast';
}

interface MenuSections {
  specials: MenuItem[];
  groups: Array<{ category: string; items: MenuItem[] }>;
}

/** Today's menu for one meal: specials first (entrees, then starters, sides, desserts), then each category. */
export function menuSections(meal: MealName, entreesOnly: boolean): MenuSections {
  const seen = new Set<string>();
  const all: Array<{ category: string; item: MenuItem }> = [];
  for (const [category, items] of Object.entries(menu[meal] ?? {})) {
    if (/add-?ons?|fees?/i.test(category)) continue;
    for (const item of items) {
      if (isDrink(item.id) || seen.has(item.id) || (entreesOnly && !item.entree)) continue;
      seen.add(item.id);
      all.push({ category: entreesOnly || /^specials?$/i.test(category) ? 'Entrées' : category, item });
    }
  }
  const rank = (it: MenuItem) => (it.entree ? 0 : it.course === 1 ? 1 : it.course === 3 ? 3 : 2);
  const specials = all.filter((x) => x.item.special).map((x) => x.item).sort((a, b) => rank(a) - rank(b));
  const groups: MenuSections['groups'] = [];
  for (const { category, item } of all) {
    if (item.special) continue;
    const g = groups.find((x) => x.category === category);
    if (g) g.items.push(item);
    else groups.push({ category, items: [item] });
  }
  return { specials, groups };
}

/**
 * Today's menu for the kitchen: what each dish is plated with, its cook
 * notes, choices and allergens. The cook line sees entrees only.
 */
export function MenuReference({ open, onClose, entreesOnly }: { open: boolean; onClose: () => void; entreesOnly?: boolean }) {
  const [meal, setMeal] = useState<MealName>(mealNow);
  const [dish, setDish] = useState<MenuItem | null>(null);
  const marks = use86();
  const { specials, groups } = menuSections(meal, !!entreesOnly);
  const out = (it: MenuItem) => is86(marks, it.id);

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        tall
        width={780}
        title="Today's menu"
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
          options={meals.map((m) => ({ id: m.id, label: m.id }))}
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
      {dish && <DishView item={dish} out={out(dish)} onClose={() => setDish(null)} />}
    </>
  );
}

/** One dish, full screen and dark, readable from across the line. Tap anywhere or Escape to close. */
function DishView({ item, out, onClose }: { item: MenuItem; out: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      close.current();
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      previous?.focus?.();
    };
  }, []);
  const sides = defaultSides(item.id).flatMap((id) => getItem(id)?.name ?? []);
  const choices = item.mods.filter((g) => g.opts.length).slice(0, 3);
  return createPortal(
    <div ref={ref} className={s.dish} role="dialog" aria-modal="true" aria-label={item.name} tabIndex={-1} onClick={onClose}>
      <div className={s.dishInner}>
        <DishPicture name={item.name} size="hero" dark />
        <div className={s.dishText}>
          <div>
            {item.special && <div className={s.special}>Today&apos;s special</div>}
            <div className={s.dishName}>{item.name}</div>
            {item.desc && <div className={s.dishDesc}>{item.desc}</div>}
            {out && <div className={s.dish86}>86&apos;d</div>}
          </div>
          <Fact label="Plated with" text={sides.length ? sides.join(' · ') : 'No default sides'} quiet={!sides.length} />
          <Fact label="Cook notes" text={item.cookNotes || 'No cook notes on this recipe yet.'} tone={item.cookNotes ? 'gold' : undefined} quiet={!item.cookNotes} />
          {choices.length > 0 && (
            <div>
              <div className={s.factLabel}>Choices</div>
              {choices.map((g) => (
                <div key={g.group} className={s.choice}>
                  <b>{g.group}</b>: {g.opts.join(', ')}
                  {g.default ? ` (comes with ${g.default})` : ''}
                </div>
              ))}
            </div>
          )}
          <Fact label="Allergens" text={item.allergens.length ? item.allergens.join(', ') : 'None listed'} tone={item.allergens.length ? 'red' : undefined} />
          <div className={s.closeHint}>Tap anywhere to close</div>
        </div>
      </div>
    </div>,
    document.getElementById('root') ?? document.body,
  );
}

function Fact({ label, text, tone, quiet }: { label: string; text: string; tone?: 'gold' | 'red'; quiet?: boolean }) {
  return (
    <div>
      <div className={s.factLabel}>{label}</div>
      <div className={cx(s.fact, tone && s[`fact_${tone}`], quiet && s.factQuiet)}>{text}</div>
    </div>
  );
}
