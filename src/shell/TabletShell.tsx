import type { ReactNode } from 'react';
import { AccountMenu, ModeChip, TextZoom, VenueChip } from './controls';
import s from './TabletShell.module.css';

export interface TabletShellProps {
  /** Left side of the header after the venue chip: the surface's own nav. */
  nav?: ReactNode;
  /** Right side of the header before the mode switch: page buttons. */
  actions?: ReactNode;
  /**
   * Vertical action rail on the right (Full screen, Notices, Voice, + Check).
   * It gets its own column so it never covers tables or row actions.
   */
  rail?: ReactNode;
  /** Hide the venue picker (surfaces that serve every venue). */
  hideVenue?: boolean;
  children: ReactNode;
}

/** Chrome shared by the tablet surfaces: Server, Manager, Host, Bar, PU & Delivery. */
export function TabletShell({ nav, actions, rail, hideVenue, children }: TabletShellProps) {
  return (
    <div className={s.shell}>
      <header className={s.header}>
        {!hideVenue && <VenueChip />}
        {nav}
        <span className={s.grow} />
        <TextZoom tall />
        <span className={s.grow} />
        {actions}
        <ModeChip tall />
        <AccountMenu />
      </header>
      <div className={s.body}>
        <main className={s.main}>{children}</main>
        {rail && <aside className={s.rail}>{rail}</aside>}
      </div>
    </div>
  );
}
