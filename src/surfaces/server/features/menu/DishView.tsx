import { getItem } from '../../../../data';
import { avoidLabel, inferAllergens } from '../../../../domain/allergens';
import { defaultSides } from '../../../../domain/menu';
import type { MenuItem } from '../../../../domain/types';
import { Modal } from '../../../../ui';
import { DishPhoto } from './DishPhoto';
import s from './DishView.module.css';

/**
 * One dish full screen on a dark background: the photo big enough to show
 * a resident across the table, and what it comes with. The kitchen's copy
 * (`cookNotes`) adds the recipe's cook notes.
 */
export function DishView({ item, out, cookNotes, onClose }: { item: MenuItem; out: boolean; cookNotes?: boolean; onClose: () => void }) {
  const sides = defaultSides(item.id)
    .map((id) => getItem(id)?.name)
    .filter((n): n is string => !!n);
  const choices = (item.mods ?? []).filter((m) => m.opts?.length).slice(0, 3);
  const allergens = item.allergens ?? [];
  // Nothing recorded: what the dish's name and description suggest.
  const maybe = allergens.length ? [] : inferAllergens(item).map(avoidLabel);
  return (
    <Modal open onClose={onClose} width="100%" tall className={s.modal}>
      <div className={s.layout} onClick={onClose}>
        <DishPhoto name={item.name} dark glyph={140} className={s.photo} />
        <div className={s.details}>
          <div>
            {item.special && <div className={s.kick}>Today's special</div>}
            <h2 className={s.name}>{item.name}</h2>
            {item.desc && <p className={s.desc}>{item.desc}</p>}
            {out && <span className={s.out}>86'd</span>}
          </div>
          <div>
            <div className={s.label}>Plated with</div>
            <div className={sides.length ? s.value : s.muted}>{sides.length ? sides.join(' · ') : 'No default sides'}</div>
          </div>
          {cookNotes && (
            <div>
              <div className={s.label}>Cook notes</div>
              <div className={item.cookNotes ? s.notes : s.muted}>{item.cookNotes || 'No cook notes on this recipe yet.'}</div>
            </div>
          )}
          {choices.length > 0 && (
            <div>
              <div className={s.label}>Choices</div>
              {choices.map((c) => (
                <div key={c.group} className={s.choice}>
                  <b>{c.group}</b>: {c.opts.join(', ')}
                  {c.default ? ` (comes with ${c.default})` : ''}
                </div>
              ))}
            </div>
          )}
          <div>
            <div className={s.label}>Allergens</div>
            <div className={allergens.length || maybe.length ? s.allergens : s.muted}>
              {allergens.length ? allergens.join(', ') : maybe.length ? `May contain ${maybe.join(', ')} (suggested, not confirmed)` : 'None listed'}
            </div>
          </div>
          <div className={s.hint}>Tap anywhere to close</div>
        </div>
      </div>
    </Modal>
  );
}
