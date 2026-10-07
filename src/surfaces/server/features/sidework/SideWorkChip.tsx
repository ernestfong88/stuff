import { useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { isOnRoster, tasksFor, useSideWork } from '../../../../store/sideWork';
import { cx } from '../../../../ui';
import { useMyInitials } from '../shared/useShiftServers';
import { SideWorkSheet } from './SideWorkSheet';
import s from './SideWorkChip.module.css';

/** "Side work 0/3" header chip and its checklist. Hidden for anyone off today's schedule. */
export function SideWorkChip({ short }: { short?: boolean }) {
  const me = useMyInitials();
  const state = useSideWork();
  const [open, setOpen] = useState(false);
  const mine = tasksFor(state, me);
  if (!mine.length && !isOnRoster(me)) return null;
  const done = mine.filter((t) => t.done).length;
  const all = mine.length > 0 && done === mine.length;
  return (
    <>
      <button
        type="button"
        className={cx(s.chip, all && s.all)}
        onClick={() => setOpen(true)}
        title={`Your side work today: ${done} of ${mine.length} done`}
        aria-label={`Side work, ${done} of ${mine.length} done`}
      >
        <ClipboardCheck size={16} strokeWidth={2} aria-hidden />
        {!short && <span>Side work</span>}
        <span className={s.count}>
          {done}/{mine.length}
        </span>
      </button>
      {open && <SideWorkSheet me={me} onClose={() => setOpen(false)} />}
    </>
  );
}
