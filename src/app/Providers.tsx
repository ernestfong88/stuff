import { useEffect, type ReactNode } from 'react';
import { useRoute } from '../shell/router';
import { useSignedIn } from '../shell/session';
import { registerDemoAction } from '../shell/demoTools';
import { isoDate } from '../domain/pickup';
import { syncAssocItems, useAssocMenuSettings } from '../store/assocMenu';
import { DiningProvider, useDiningActions } from '../store/dining';
import { setSessionMode, setSignedIn } from '../store/session';

/** Tells the dining store which surface this tab is and who is signed in (for check timelines and takeovers). */
function SessionBridge() {
  const { mode } = useRoute();
  const me = useSignedIn();
  useEffect(() => setSessionMode(mode), [mode]);
  useEffect(() => setSignedIn(me?.initials ?? null), [me]);
  return null;
}

/** Demo tools, at the top of the screen menu on every screen. */
function DemoTools() {
  const { resetDemo, clearAll } = useDiningActions();
  useEffect(() => {
    const offReset = registerDemoAction({
      id: 'reset',
      label: 'Reset demo data',
      confirm: 'Put every check, ticket, note and setting back to the start of the demo, on every screen.',
      run: resetDemo,
    });
    const offClear = registerDemoAction({
      id: 'clear',
      label: 'Clear all tickets',
      confirm: 'Remove every open check and ticket from every screen, for an empty floor.',
      run: clearAll,
    });
    return () => {
      offReset();
      offClear();
    };
  }, [resetDemo, clearAll]);
  return null;
}

// Associate menu dishes the dining room menu doesn't carry are orderable (and named on tickets) from the start.
syncAssocItems(isoDate(0));

/** Keeps them in step when the chef changes the associate menu. */
function AssocItems() {
  const s = useAssocMenuSettings();
  useEffect(() => syncAssocItems(isoDate(0), s), [s]);
  return null;
}

/**
 * Keeps the floor's menu on each venue's menu cycle with nobody editing in
 * Back Office: today's cycle day (and so the specials) follows each venue's
 * "Week 1 started" and changes when the day rolls over. The menu model loads
 * on its own, after the screen.
 */
function LiveMenu() {
  useEffect(() => {
    if (import.meta.env.MODE === 'test') return;
    let stop: (() => void) | undefined;
    let gone = false;
    void import('../surfaces/backoffice/menus/data').then((m) => {
      if (!gone) stop = m.keepLiveMenu();
    });
    return () => {
      gone = true;
      stop?.();
    };
  }, []);
  return null;
}

/** App-wide providers. */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <DiningProvider>
      <SessionBridge />
      <DemoTools />
      <AssocItems />
      <LiveMenu />
      {children}
    </DiningProvider>
  );
}
