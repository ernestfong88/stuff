import { useRef, type ReactNode } from 'react';
import { AccountMenu, ModeChip, TextZoom, VenueChip } from './controls';
import { HeaderFitContext, useFitLevel } from './headerFit';
import s from './TabletShell.module.css';

export interface TabletShellProps {
  /** Left side of the header after the venue chip: the surface's own nav. */
  nav?: ReactNode;
  /** Right side of the header before the mode switch: page buttons. */
  actions?: ReactNode;
  /**
   * Vertical action rail on the right (Full screen, Notices, Voice, + Check).
   * It gets its own column so it never covers tables or row actions; held
   * upright, it becomes a bar along the bottom instead.
   */
  rail?: ReactNode;
  /** Hide the venue picker (surfaces that serve every venue). */
  hideVenue?: boolean;
  /** Changes when the header's buttons change (another view), so it fits itself again from full labels. */
  fitKey?: string;
  children: ReactNode;
}

/** Chrome shared by the tablet surfaces: Server, Manager, Host, Bar, PU & Delivery. */
export function TabletShell({ nav, actions, rail, hideVenue, fitKey, children }: TabletShellProps) {
  const header = useRef<HTMLElement>(null);
  // The header folds its labels until it fits on one row (see headerFit), so the mode switch and avatar always show.
  const fit = useFitLevel([header], fitKey);
  return (
    <div className={s.shell}>
      <HeaderFitContext.Provider value={fit}>
        <header ref={header} className={s.header} data-fit={fit}>
          {!hideVenue && <VenueChip short={fit >= 1} />}
          {nav}
          <span className={s.grow} />
          <TextZoom tall compact={fit >= 4} />
          <span className={s.grow} />
          {actions}
          <ModeChip tall />
          <AccountMenu size={44} />
        </header>
      </HeaderFitContext.Provider>
      <div className={s.body}>
        <main className={s.main}>{children}</main>
        {rail && <aside className={s.rail}>{rail}</aside>}
      </div>
    </div>
  );
}
