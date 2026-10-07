import { useState } from 'react';
import { ChevronRight, Images } from 'lucide-react';
import { dishPhoto } from '../../../../data/photos';
import type { MealName, MenuItem } from '../../../../domain/types';
import { today } from '../../../../lib/clock';
import { is86, use86 } from '../../../../store/eightySix';
import { Button, Chip, Modal, Tabs, cx } from '../../../../ui';
import { DishPhoto } from './DishPhoto';
import { DishView } from './DishView';
import { MEALS, mealAt, menuSections } from './menuSections';
import s from './MenuReference.module.css';

function OutBadge() {
  return (
    <Chip tone="danger" solid size="xs">
      86
    </Chip>
  );
}

/**
 * Today's menu for describing dishes at the table: specials first with
 * photos, every other dish by category, and a photo gallery. Tap a dish to
 * see it full screen with what it comes with.
 */
export function MenuReference({ meal: initialMeal, onClose }: { meal?: MealName; onClose: () => void }) {
  const marks = use86();
  const [meal, setMeal] = useState<MealName>(initialMeal ?? mealAt(today().getHours()));
  const [photos, setPhotos] = useState(false);
  const [view, setView] = useState<MenuItem | null>(null);
  const { specials, categories, all } = menuSections(meal);
  const withPhoto = all.filter((it) => dishPhoto(it.name)).length;

  const name = (it: MenuItem) => <span className={cx(s.name, is86(marks, it.id) && s.outName)}>{it.name}</span>;

  return (
    <>
      <Modal
        open
        onClose={onClose}
        width={photos ? 1100 : 780}
        className={s.modal}
        title="Today's menu"
        subtitle={photos ? `Dish photos · ${withPhoto} of ${all.length} have a photo` : 'Specials first. Tap a dish to see its photo full screen and what it comes with.'}
      >
        <div className={s.toolbar}>
          <Tabs aria-label="Meal" value={meal} onChange={setMeal} options={MEALS.map((m) => ({ id: m, label: m }))} />
          <span className={s.grow} />
          <Button variant={photos ? 'dark' : 'secondary'} icon={<Images size={16} />} aria-pressed={photos} onClick={() => setPhotos((v) => !v)}>
            Dish photos
          </Button>
          <Button onClick={onClose}>Done</Button>
        </div>

        {!all.length && <p className={s.none}>Nothing on the {meal.toLowerCase()} menu today.</p>}

        {photos && all.length > 0 && !withPhoto && (
          <p className={s.noPhotos}>No dish photos have been added yet, so every dish shows a plate for now.</p>
        )}
        {photos ? (
          <div className={s.gallery}>
            {all.map((it) => (
              <button key={it.id} type="button" className={s.tile} onClick={() => setView(it)}>
                <DishPhoto name={it.name} className={s.tilePhoto} glyph={56} />
                <span className={s.tileName}>
                  {name(it)}
                  {is86(marks, it.id) && <OutBadge />}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <>
            {specials.length > 0 && (
              <section>
                <h3 className={cx(s.head, s.headSpecial)}>Today's specials · {specials.length}</h3>
                <div className={s.specials}>
                  {specials.map((it) => (
                    <button key={it.id} type="button" className={s.card} onClick={() => setView(it)}>
                      <DishPhoto name={it.name} wide className={s.cardPhoto} glyph={46} />
                      <span className={s.cardText}>
                        <span className={s.cardTitle}>
                          {name(it)}
                          {is86(marks, it.id) && <OutBadge />}
                        </span>
                        {it.desc && <span className={s.cardDesc}>{it.desc}</span>}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}
            {categories.map((c) => (
              <section key={c.name}>
                <h3 className={s.head}>
                  {c.name} · {c.items.length}
                </h3>
                <div className={s.list}>
                  {c.items.map((it) => (
                    <button key={it.id} type="button" className={s.row} onClick={() => setView(it)}>
                      <DishPhoto name={it.name} className={s.thumb} glyph={20} />
                      <span className={s.rowText}>
                        {name(it)}
                        {it.desc && <span className={s.rowDesc}>{it.desc}</span>}
                      </span>
                      {is86(marks, it.id) && <OutBadge />}
                      <ChevronRight size={18} className={s.chev} aria-hidden />
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </>
        )}
      </Modal>
      {view && <DishView item={view} out={is86(marks, view.id)} onClose={() => setView(null)} />}
    </>
  );
}
