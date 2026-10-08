import { AlertTriangle, Pause, Pencil, Play, X } from 'lucide-react';
import { getItem } from '../../../../data';
import { chosenMods, flattenMods, isDrink, serverItemName } from '../../../../domain/menu';
import { conflictSentence } from '../../../../domain/allergens';
import { allergenConflicts, lineCourse } from '../../../../domain/orders';
import type { Diner, Order, OrderLine, Resident } from '../../../../domain/types';
import { useConfig } from '../../../../store/config';
import { useDining } from '../../../../store/dining';
import { cx } from '../../../../ui';
import { priceTag, shownPrice } from '../checkLines';
import { CoursePick, DrinkChip, LineState, LineTags, type CourseChoice } from './LineChips';
import { LineMenu } from './LineMenu';
import s from './LineRow.module.css';

/** One line on a diner's card. Tap an unsent line to change how it is made. */
export function LineRow({
  order: o,
  diner,
  line,
  person,
  onEdit,
}: {
  order: Order;
  diner: Diner;
  line: OrderLine;
  /** Whose allergies count for this diner (none for a guest). */
  person: Resident | undefined;
  onEdit: () => void;
}) {
  const cfg = useConfig();
  const dining = useDining();
  const it = getItem(line.itemId);
  const conflicts = allergenConflicts(line, person);
  const price = shownPrice(line, diner);
  const tag = priceTag(line, diner);
  const mods = flattenMods(chosenMods(line.mods, it, cfg));
  const drink = isDrink(line.itemId);
  const editable = !line.sent;

  const pickCourse = (v: CourseChoice) => {
    const family = [line, ...diner.items.filter((x) => x.parentId === line.id)];
    if (v === 'togo') {
      for (const x of family) if (!!x.toGo === !!line.toGo) dining.setToGo(o.id, diner.id, x.id);
      return;
    }
    for (const x of family) {
      if (!x.sent) dining.setLineCourse(o.id, diner.id, x.id, v);
      if (x.toGo) dining.setToGo(o.id, diner.id, x.id);
    }
  };

  const resident = diner.kind === 'resident' && !diner.isGuest && !drink ? (person ?? null) : null;

  return (
    <div className={cx(s.row, line.parentId && s.child)}>
      <div
        className={cx(s.main, editable && s.editable)}
        role={editable ? 'button' : undefined}
        tabIndex={editable ? 0 : undefined}
        aria-label={editable ? `Change ${it?.name ?? 'item'}` : undefined}
        onClick={editable ? onEdit : undefined}
        onKeyDown={
          editable
            ? (e) => {
                if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  onEdit();
                }
              }
            : undefined
        }
      >
        <div className={s.top}>
          {line.parentId ? (
            <span className={s.indent} />
          ) : o.queueType ? null : drink ? (
            <DrinkChip line={line} onDelivered={() => dining.serveDrinks(o.id, [line.id])} />
          ) : (
            <CoursePick course={lineCourse(line)} toGo={!!line.toGo} editable={editable} onPick={pickCourse} />
          )}
          <span className={s.text}>
            <span className={s.name} title={it?.name}>
              {serverItemName(it?.name ?? 'Item', cfg)}
            </span>
            {editable && <Pencil size={11} className={s.pencil} aria-hidden />}
            <LineTags line={line} />
            <LineState line={line} />
          </span>
        </div>
        {(mods.length > 0 || line.note) && (
          <div className={cx(s.mods, o.queueType && !line.parentId && s.modsQueue)}>
            {mods.join(' · ')}
            {line.note && <span className={s.note}>“{line.note}”</span>}
          </div>
        )}
        {conflicts.length > 0 && (
          <div className={s.allergy}>
            <AlertTriangle size={12} aria-hidden /> {conflictSentence(conflicts, person?.name.split(' ')[0] ?? 'This diner')}
          </div>
        )}
      </div>
      <div className={cx(s.price, tag && s.priceTagged)}>
        {price ? `$${price}` : ''}
        {tag && <span className={s.priceTag}>{tag}</span>}
      </div>
      {line.sent && !line.comped && !line.cancelled && (
        <LineMenu
          order={o}
          line={line}
          resident={resident}
          onRemake={() => dining.remakeLine(o.id, diner.id, line.id)}
          onCancel={() => dining.cancelLine(o.id, diner.id, line.id)}
        />
      )}
      {!line.sent && (
        <div className={s.unsent}>
          <button
            className={cx(s.iconBtn, line.hold && s.holdOn)}
            title={line.hold ? 'Release it so it goes with the next send' : 'Hold it back from the next send'}
            aria-label={line.hold ? 'Release' : 'Hold'}
            aria-pressed={!!line.hold}
            onClick={() => dining.toggleHold(o.id, diner.id, line.id)}
          >
            {line.hold ? <Play size={13} aria-hidden /> : <Pause size={13} aria-hidden />}
          </button>
          <button
            className={cx(s.iconBtn, s.remove)}
            aria-label={`Remove ${it?.name ?? 'item'}`}
            onClick={() => dining.removeItem(o.id, diner.id, line.id)}
          >
            <X size={14} strokeWidth={2.5} aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
