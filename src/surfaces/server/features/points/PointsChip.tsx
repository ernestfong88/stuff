import { Sparkles } from 'lucide-react';
import { ordinal } from '../../../../lib/format';
import { useNotes } from '../../../../store/notes';
import { useMyInitials, useShiftServers } from '../shared/useShiftServers';
import { requestedTab } from '../shift/shiftState';
import { noteRank } from './noteRank';
import s from './PointsChip.module.css';

/** "6 pts · 2nd of 3" header chip; onOpen goes to the shift review notes. */
export function PointsChip({ short, onOpen }: { short?: boolean; onOpen: () => void }) {
  const me = useMyInitials();
  const notes = useNotes();
  const servers = useShiftServers();
  const r = noteRank(notes, me, servers);
  const pts = r.mine === 1 ? 'pt' : 'pts';
  const place = r.of > 1 ? `${ordinal(r.rank)} of ${r.of}` : null;
  return (
    <button
      type="button"
      className={s.chip}
      onClick={() => {
        requestedTab.set('notes');
        onOpen();
      }}
      title="Things you added about residents this shift, and where that puts you among tonight's servers"
      aria-label={`${r.mine} ${pts}${place ? ', ' + place + ' servers' : ''}. Open your people notes`}
    >
      <Sparkles size={14} strokeWidth={2.2} aria-hidden />
      <span>
        {r.mine}
        {!short && ` ${pts}`}
      </span>
      {place && <span className={s.place}>· {short ? ordinal(r.rank) : place}</span>}
    </button>
  );
}
