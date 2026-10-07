import { useState } from 'react';
import { MoreHorizontal, ThumbsDown, ThumbsUp } from 'lucide-react';
import { getItem } from '../../../../data';
import { tableName } from '../../../../domain/orders';
import type { Order, OrderLine, Resident } from '../../../../domain/types';
import { addNote } from '../../../../store/notes';
import { cx } from '../../../../ui';
import { AnchoredMenu } from '../../shared/AnchoredMenu';
import s from './LineMenu.module.css';

/**
 * Remake and Cancel are rare, so on a sent line they wait behind three dots
 * instead of taking room on every plate. A resident's dish can also get
 * quick feedback for the culinary team.
 */
export function LineMenu({
  order,
  line,
  resident,
  onRemake,
  onCancel,
}: {
  order: Order;
  line: OrderLine;
  /** Set when the diner is a resident (not a guest) and the line is food. */
  resident: Resident | null;
  onRemake: () => void;
  onCancel: () => void;
}) {
  const canRemake = !line.rush && line.kitchenState !== 'scheduled';
  const started = line.kitchenState !== 'scheduled';
  return (
    <AnchoredMenu
      label="Line actions"
      width={260}
      height={resident ? 330 : 150}
      align="right"
      trigger={({ open, toggle }) => (
        <button
          className={cx(s.dots, open && s.dotsOpen)}
          title="Feedback, remake or cancel this plate"
          aria-label="Feedback, remake or cancel this plate"
          aria-expanded={open}
          onClick={(e) => {
            e.stopPropagation();
            toggle();
          }}
        >
          <MoreHorizontal size={18} strokeWidth={2.5} aria-hidden />
        </button>
      )}
    >
      {({ close }) => (
        <>
          {resident && <LineFeedback order={order} line={line} resident={resident} onDone={close} />}
          {canRemake && (
            <button
              role="menuitem"
              className={cx(s.item, s.remake)}
              onClick={() => {
                close();
                onRemake();
              }}
            >
              Remake
              <span className={s.sub}>Fires a rushed replacement and comps this one</span>
            </button>
          )}
          <button
            role="menuitem"
            className={cx(s.item, canRemake && s.split)}
            onClick={() => {
              close();
              onCancel();
            }}
          >
            Cancel
            <span className={s.sub}>
              {started ? 'Stays on the check and the cook is told to stop' : 'The kitchen has not started it, so it comes straight off'}
            </span>
          </button>
        </>
      )}
    </AnchoredMenu>
  );
}

/** "How did Ruth like it?" Liked it / Didn't, with an optional note, saved as dining feedback. */
function LineFeedback({ order, line, resident, onDone }: { order: Order; line: OrderLine; resident: Resident; onDone: () => void }) {
  const it = getItem(line.itemId);
  const [verdict, setVerdict] = useState<'pos' | 'neg' | null>(null);
  const [text, setText] = useState('');
  const [saved, setSaved] = useState(false);
  if (!it) return null;
  const save = () => {
    const note = text.trim() || (verdict === 'pos' ? 'Liked the ' : 'Did not like the ') + it.name + '.';
    addNote('fb', resident.id, note, { by: order.server, table: tableName(order), src: 'tap', dish: it.name, sentiment: verdict });
    setSaved(true);
    setTimeout(onDone, 700);
  };
  return (
    <div className={s.fb}>
      <div className={s.fbTitle}>{saved ? 'Saved for the culinary team' : `How did ${resident.name.split(' ')[0]} like it?`}</div>
      {!saved && (
        <div className={s.fbRow}>
          <button className={cx(s.verdict, verdict === 'pos' && s.pos)} aria-pressed={verdict === 'pos'} onClick={() => setVerdict('pos')}>
            <ThumbsUp size={14} aria-hidden /> Liked it
          </button>
          <button className={cx(s.verdict, verdict === 'neg' && s.neg)} aria-pressed={verdict === 'neg'} onClick={() => setVerdict('neg')}>
            <ThumbsDown size={14} aria-hidden /> Didn't
          </button>
        </div>
      )}
      {verdict && !saved && (
        <>
          <input
            className={s.input}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a note (optional)"
            aria-label="Feedback note"
          />
          <button className={s.save} onClick={save}>
            Save feedback
          </button>
        </>
      )}
    </div>
  );
}
