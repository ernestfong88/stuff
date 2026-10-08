import { Check } from 'lucide-react';
import { formatTime } from '../../lib/format';
import { setCheck, type CheckMark, type ChecklistGroup, type ChecklistItem, type PrepMeal } from '../../store/production';
import { cx } from '../../ui';
import { CHECK_LABEL } from './logic';
import s from './Checklist.module.css';

interface ChecklistProps {
  groups: ChecklistGroup[];
  markOf: (item: ChecklistItem) => CheckMark | null;
  venueId: string;
  iso: string;
  meal: PrepMeal;
  cook: string;
}

/** The venue's checklist for the meal on screen, grouped as Back Office set it up. */
export function Checklist({ groups, markOf, venueId, iso, meal, cook }: ChecklistProps) {
  return (
    <div className={s.grid}>
      {groups.map((g) => {
        const done = g.items.filter((it) => markOf(it)).length;
        return (
          <section key={g.id} aria-label={g.name} className={s.group}>
            <header className={s.head}>
              <h3 className={s.name}>{g.name}</h3>
              <span className={cx(s.count, done === g.items.length && s.countDone)}>
                {done} of {g.items.length}
              </span>
            </header>
            <div className={s.items}>
              {g.items.map((it) => (
                <ChecklistRow key={it.id} item={it} mark={markOf(it)} onSet={(how) => setCheck(venueId, iso, meal, it.id, how, cook)} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

interface RowProps {
  item: ChecklistItem;
  mark: CheckMark | null;
  onSet: (how: CheckMark['how'] | null) => void;
}

function ChecklistRow({ item, mark, onSet }: RowProps) {
  const box = (
    <span className={cx(s.box, mark && s.boxOn)} aria-hidden>
      {mark && <Check size={16} strokeWidth={3} />}
    </span>
  );
  const text = (
    <span className={s.text}>
      <span className={s.label}>{item.text}</span>
      {mark && (
        <span className={s.stamp}>
          {CHECK_LABEL[mark.how]} · {mark.by} · {formatTime(mark.at)}
        </span>
      )}
    </span>
  );

  // A stocked item asks how: stocked, or a backup made.
  if (item.stock && !mark) {
    return (
      <div className={cx(s.row, s.stockRow)}>
        {box}
        {text}
        <span className={s.choices} role="group" aria-label={item.text}>
          <button className={s.choice} onClick={() => onSet('stocked')}>
            Stocked
          </button>
          <button className={s.choice} onClick={() => onSet('backup')}>
            Made a backup
          </button>
        </span>
      </div>
    );
  }

  // Done stays done until Undo, so a stray tap can't wipe who did it and when.
  if (mark) {
    return (
      <div className={cx(s.row, s.rowDone)}>
        {box}
        {text}
        <button className={s.undo} onClick={() => onSet(null)} aria-label={`Undo ${item.text}`}>
          Undo
        </button>
      </div>
    );
  }

  return (
    <button className={cx(s.row, s.tap)} aria-pressed={false} onClick={() => onSet('done')}>
      {box}
      {text}
    </button>
  );
}
