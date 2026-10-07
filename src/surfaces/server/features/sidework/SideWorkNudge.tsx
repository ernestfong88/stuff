import { useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { tasksFor, useSideWork, useSideWorkOn } from '../../../../store/sideWork';
import { Button } from '../../../../ui';
import { SideWorkSheet } from './SideWorkSheet';
import s from './SideWorkNudge.module.css';

/** Shift review, once Sign off is tapped: a reminder about open side work, never a block. */
export function SideWorkNudge({ who, verb = 'sign off' }: { who: string; verb?: string }) {
  const state = useSideWork();
  const [open, setOpen] = useState(false);
  const inUse = useSideWorkOn();
  const left = tasksFor(state, who).filter((t) => !t.done);
  if (!inUse || !left.length) return null;
  return (
    <div className={s.nudge} role="status">
      <ClipboardCheck size={22} className={s.icon} aria-hidden />
      <div className={s.body}>
        <div className={s.title}>
          {left.length} side work task{left.length === 1 ? '' : 's'} not checked off
        </div>
        <div className={s.text}>
          {left.map((t) => t.name).join(', ')}. Check off what's done, or tell your manager. You can still {verb}.
        </div>
        <Button variant="dark" className={s.btn} onClick={() => setOpen(true)}>
          Open my side work
        </Button>
      </div>
      {open && <SideWorkSheet me={who} onClose={() => setOpen(false)} />}
    </div>
  );
}
