import { Check } from 'lucide-react';
import { getStaff } from '../../../../data';
import { formatTime } from '../../../../lib/format';
import { checkSideWork, isOnRoster, rosterName, tasksFor, useSideWork, venueName, whenLabel } from '../../../../store/sideWork';
import { Modal, cx } from '../../../../ui';
import s from './SideWorkSheet.module.css';

/** Full name for a staff member on the PIN list or today's roster. */
export function staffName(id: string): string {
  return getStaff(id)?.name ?? rosterName(id) ?? id;
}

/**
 * A server's own side work, opened from the chip on My Tables or the nudge
 * in Shift Review. A tap checks a task off with the time.
 */
export function SideWorkSheet({ me, onClose }: { me: string; onClose: () => void }) {
  const state = useSideWork();
  const mine = tasksFor(state, me);
  const done = mine.filter((t) => t.done).length;
  const manyVenues = new Set(mine.map((t) => t.venue)).size > 1;
  return (
    <Modal
      open
      onClose={onClose}
      width={580}
      className={s.modal}
      title="Your side work"
      subtitle={`Today · ${staffName(me)} · ${done} of ${mine.length} done`}
      footer={<p className={s.foot}>Tap a task when it's done. Your manager sees the check and the time right away.</p>}
    >
      {mine.length ? (
        <ul className={s.list}>
          {mine.map((t) => {
            const d = t.done;
            return (
              <li key={t.venue + t.id}>
                <button
                  type="button"
                  className={cx(s.task, d && s.done)}
                  aria-pressed={!!d}
                  onClick={() => checkSideWork(t.venue, t.id, me, !d)}
                  title={d ? 'Tap to uncheck' : "Tap when it's done"}
                >
                  <span className={s.box} aria-hidden>
                    {d && <Check size={18} strokeWidth={3} />}
                  </span>
                  <span className={s.text}>
                    <span className={s.name}>{t.name}</span>
                    {t.note && <span className={s.note}>{t.note}</span>}
                    <span className={s.meta}>
                      {d
                        ? `Done at ${formatTime(d.at)}`
                        : whenLabel(t.when) + (t.mins ? ` · about ${t.mins} min` : '') + (manyVenues ? ` · ${venueName(t.venue)}` : '')}
                    </span>
                  </span>
                  {d && <span className={s.undo}>Undo</span>}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={s.empty}>
          {isOnRoster(me)
            ? 'No side work for you yet today. Your manager hands it out on the manager tablet or in Back Office.'
            : "You're not on today's schedule, so there is no side work for you."}
        </p>
      )}
    </Modal>
  );
}
