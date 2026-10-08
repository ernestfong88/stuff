import { ArrowLeft, Check, ChevronDown, ClipboardList, ListChecks, Map as MapIcon, ShoppingBag, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Order } from '../../domain/types';
import { formatTime } from '../../lib/format';
import { useHeaderFit } from '../../shell/headerFit';
import { cx, MenuItem, Popover, useNow } from '../../ui';
import type { MineMode } from '../../store/serverMine';
import { MenuReferenceButton, PointsChip, SideWorkChip } from './features';
import { HeaderMore } from './HeaderMore';
import s from './ServerNav.module.css';

export type ServerView = 'mine' | 'new' | 'check' | 'residents' | 'shift';

const MINE_MODES: Array<{ id: MineMode; label: string; hint: string; icon: ReactNode }> = [
  { id: 'tables', label: 'My tables', hint: 'Your tables by what they need next', icon: <ClipboardList size={16} strokeWidth={2} /> },
  { id: 'pud', label: 'P/U & delivery', hint: 'The pick up and delivery queue', icon: <ShoppingBag size={16} strokeWidth={2} /> },
  { id: 'map', label: 'Table map', hint: 'Every table and its status, as the manager sees it', icon: <MapIcon size={16} strokeWidth={2} /> },
];

/**
 * Left side of the header: the My tables button, points, side work and the
 * other servers' tables. The button shows one of three views (my tables,
 * pick up & delivery, the table map) and opens a menu to swap between them.
 */
export function ServerNavLeft({
  view,
  me,
  viewServer,
  live,
  mode,
  counts,
  onMine,
  onViewServer,
  onShift,
}: {
  view: ServerView;
  me: string;
  viewServer: string;
  /** Open dine-in checks in this venue. */
  live: Order[];
  mode: MineMode;
  /** Badge count for each view. */
  counts: Record<MineMode, number>;
  /** Go to My tables; with a mode, switch to that view first. */
  onMine: (mode?: MineMode) => void;
  onViewServer: (server: string) => void;
  onShift: () => void;
}) {
  // The header folds to fit (see shell/headerFit): 1 short chips, 2 icon-only views, 4 no side work chip.
  const fit = useHeaderFit();
  const servers = [...new Set([me, ...live.map((o) => o.server)])].sort();
  const count = (id: string) => live.filter((o) => o.server === id).length;
  const onMineView = (view === 'mine' || view === 'new') && (viewServer === me || mode !== 'tables');
  const current = MINE_MODES.find((x) => x.id === mode) ?? MINE_MODES[0];
  const backShows = onMineView && mode !== 'tables';
  return (
    <>
      {backShows && (
        // Pick up & delivery and the table map are a tap away from My tables, and so is the way back.
        <button className={s.btn} onClick={() => onMine('tables')} title="Back to My tables">
          <ArrowLeft size={16} strokeWidth={2.25} />
          {fit < 2 ? ' My tables' : <span className="sr-only">My tables</span>}
          <span className={s.count}>{counts.tables}</span>
        </button>
      )}
      <Popover
        align="left"
        minWidth={280}
        trigger={({ open, toggle }) => (
          <button
            className={cx(s.btn, onMineView && s.on)}
            // Away from it, the button goes back to the view; on it, it opens the menu to swap views.
            onClick={() => (onMineView ? toggle() : onMine())}
            title={onMineView ? 'Switch view' : current.label}
            aria-haspopup="menu"
            aria-expanded={open}
          >
            {current.icon}
            {fit < 2 ? ` ${current.label}` : <span className="sr-only">{current.label}</span>}
            <span className={s.count}>{counts[mode]}</span>
            {onMineView && <ChevronDown size={14} strokeWidth={2.5} className={cx(s.chev, open && s.chevOpen)} aria-hidden />}
          </button>
        )}
      >
        {({ close }) =>
          MINE_MODES.map((x) => (
            <MenuItem
              key={x.id}
              active={x.id === mode}
              icon={x.icon}
              end={x.id === mode ? <Check size={15} strokeWidth={2.5} /> : <span className={s.menuCount}>{counts[x.id]}</span>}
              onClick={() => {
                close();
                onMine(x.id);
              }}
            >
              <span className={s.menuLabel}>{x.label}</span>
              <span className={s.menuHint}>{x.hint}</span>
            </MenuItem>
          ))
        }
      </Popover>
      {/* The way back to My tables takes room, so the chips go short while it shows. */}
      <PointsChip short={fit >= 1 || backShows} onOpen={onShift} />
      {fit < 4 && <SideWorkChip short={fit >= 1 || backShows} />}
      {view === 'mine' && mode === 'tables' && (
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

/**
 * The time of day, as on the kitchen screens ("5:45 PM"). It never folds
 * away: once the least-used chips have stepped aside (fold 4) it drops the
 * AM/PM. Its own component, so the tick redraws only the clock.
 */
export function ServerClock() {
  const fit = useHeaderFit();
  const t = useNow(1000);
  const full = formatTime(t);
  return (
    <time className={s.clock} dateTime={new Date(t).toISOString()} aria-label={`Time ${full}`} title={full}>
      {fit >= 4 ? full.replace(/\s*[AP]M$/, '') : full}
    </time>
  );
}

/** Right side of the header: the clock, the menu reference, Residents and Shift Review; a More menu when the header is short of room. */
export function ServerNavRight({ view, onResidents, onShift }: { view: ServerView; onResidents: () => void; onShift: () => void }) {
  const fit = useHeaderFit();
  if (fit >= 3) {
    return (
      <>
        <ServerClock />
        <HeaderMore
          pages={[
            { label: 'Residents', icon: <Users size={16} strokeWidth={2} />, active: view === 'residents', onClick: onResidents },
            { label: 'Shift Review', icon: <ListChecks size={16} strokeWidth={2} />, active: view === 'shift', onClick: onShift },
          ]}
        />
      </>
    );
  }
  const short = fit >= 1;
  return (
    <>
      <ServerClock />
      <MenuReferenceButton short={short} className={s.ref} />
      <button
        className={cx(s.btn, view === 'residents' && s.onResidents)}
        onClick={onResidents}
        title="Residents"
        aria-pressed={view === 'residents'}
      >
        <Users size={15} strokeWidth={2} aria-hidden />
        {short ? <span className="sr-only">Residents</span> : ' Residents'}
      </button>
      <button className={cx(s.btn, view === 'shift' && s.onShift)} onClick={onShift} title="Shift Review" aria-pressed={view === 'shift'}>
        <ListChecks size={15} strokeWidth={2} aria-hidden />
        {short ? <span className="sr-only">Shift Review</span> : ' Shift Review'}
      </button>
    </>
  );
}
