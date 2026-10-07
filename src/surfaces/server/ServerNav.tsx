import { ClipboardList, ListChecks, Users } from 'lucide-react';
import type { Order } from '../../domain/types';
import { cx, useViewportWidth } from '../../ui';
import { MenuReferenceButton, PointsChip, SideWorkChip } from './features';
import s from './ServerNav.module.css';

export type ServerView = 'mine' | 'new' | 'check' | 'residents' | 'shift';

/** Header row narrows to icons below this width rather than wrapping. */
const NARROW = 1100;

/** Left side of the header: My tables, points, side work and the other servers' tables. */
export function ServerNavLeft({
  view,
  me,
  viewServer,
  live,
  onMine,
  onViewServer,
  onShift,
}: {
  view: ServerView;
  me: string;
  viewServer: string;
  /** Open dine-in checks in this venue. */
  live: Order[];
  onMine: () => void;
  onViewServer: (server: string) => void;
  onShift: () => void;
}) {
  const width = useViewportWidth();
  const narrow = width < NARROW;
  const servers = [...new Set([me, ...live.map((o) => o.server)])].sort();
  const count = (id: string) => live.filter((o) => o.server === id).length;
  const onMineView = (view === 'mine' || view === 'new') && viewServer === me;
  return (
    <>
      <button className={cx(s.btn, onMineView && s.on)} onClick={onMine} title="My tables" aria-pressed={onMineView}>
        <ClipboardList size={15} strokeWidth={2} aria-hidden />
        {width >= 900 ? ' My tables' : <span className="sr-only">My tables</span>}
        <span className={s.count}>{count(me)}</span>
      </button>
      <PointsChip short={narrow} onOpen={onShift} />
      {width >= 900 && <SideWorkChip short={width < 1200} />}
      {view === 'mine' && (
        <div className={cx(s.servers, 'scroll-hidden')} role="group" aria-label="Other servers' tables">
          {servers
            .filter((id) => id !== me)
            .map((id) => (
              <button
                key={id}
                className={cx(s.server, viewServer === id && s.serverOn)}
                aria-pressed={viewServer === id}
                title={`See ${id}'s tables`}
                onClick={() => onViewServer(viewServer === id ? me : id)}
              >
                {id} <span className={s.serverCount}>{count(id)}</span>
              </button>
            ))}
        </div>
      )}
    </>
  );
}

/** Right side of the header: the menu reference, Residents and Shift Review. */
export function ServerNavRight({ view, onResidents, onShift }: { view: ServerView; onResidents: () => void; onShift: () => void }) {
  const narrow = useViewportWidth() < NARROW;
  return (
    <>
      <MenuReferenceButton short={narrow} />
      <button
        className={cx(s.btn, view === 'residents' && s.onResidents)}
        onClick={onResidents}
        title="Residents"
        aria-pressed={view === 'residents'}
      >
        <Users size={15} strokeWidth={2} aria-hidden />
        {narrow ? <span className="sr-only">Residents</span> : ' Residents'}
      </button>
      <button className={cx(s.btn, view === 'shift' && s.onShift)} onClick={onShift} title="Shift Review" aria-pressed={view === 'shift'}>
        <ListChecks size={15} strokeWidth={2} aria-hidden />
        {narrow ? <span className="sr-only">Shift Review</span> : ' Shift Review'}
      </button>
    </>
  );
}
