import { useState } from 'react';
import { ChevronDown, RotateCcw } from 'lucide-react';
import { Button, cx, toast } from '../../../ui';
import s from './RetiredList.module.css';

/**
 * Retired rows of a billing list, folded away under the table, each with
 * Bring back. Retiring only hides a row, so this is the way back once the
 * Undo in the toast has gone.
 */
export function RetiredList<T extends { id: string; text: string; active: boolean }>({
  rows,
  setRows,
  noun,
  detail,
}: {
  rows: T[];
  setRows: (update: (rows: T[]) => T[]) => void;
  /** One row, e.g. "plan". */
  noun: string;
  detail?: (row: T) => string;
}) {
  const [open, setOpen] = useState(false);
  const retired = rows.filter((r) => !r.active);
  if (!retired.length) return null;
  return (
    <div className={s.box}>
      <button className={s.head} aria-expanded={open} onClick={() => setOpen(!open)}>
        <ChevronDown size={16} className={cx(s.chev, open && s.chevOpen)} aria-hidden />
        Retired {retired.length === 1 ? noun : `${noun}s`} ({retired.length})
        <span className={s.headHint}>Kept so closed checks keep their wording</span>
      </button>
      {open && (
        <ul className={s.list}>
          {retired.map((r) => (
            <li key={r.id} className={s.row}>
              <span className={s.text}>
                {r.text}
                {detail && <span className={s.detail}> · {detail(r)}</span>}
              </span>
              <Button
                size="sm"
                icon={<RotateCcw size={14} />}
                onClick={() => {
                  setRows((list) => list.map((x) => (x.id === r.id ? { ...x, active: true } : x)));
                  toast(`${r.text} is back on the list`, { tone: 'success' });
                }}
              >
                Bring back
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
