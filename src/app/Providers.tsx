import { useEffect, type ReactNode } from 'react';
import { useRoute } from '../shell/router';
import { useSignedIn } from '../shell/session';
import { registerDemoAction } from '../shell/demoTools';
import type { ModeId } from '../shell/modes';
import { isoDay } from '../domain/menuCycle';
import { isoDate } from '../domain/pickup';
import { now } from '../lib/clock';
import { syncAssocItems, useAssocMenuSettings } from '../store/assocMenu';
import { DiningProvider, useDiningActions } from '../store/dining';
import { menuEditsStore } from '../store/menuEdits';
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
 * Surfaces that order from a later day's menu (a pick up booked for
 * tomorrow, the kiosk) or edit menus: they keep Back Office's menu model
 * running. The others (kitchen, expo, specials TV, prep, bar, associate
 * phone) only show today's menu, which the saved overlay already holds.
 */
const MENU_MODEL_SURFACES: ReadonlySet<ModeId> = new Set<ModeId>(['server', 'manager', 'host', 'pud', 'kiosk', 'backoffice']);

const loadMenuModel = () => import('../surfaces/backoffice/menus/data');

/**
 * Today's menu without the menu model: the saved overlay is used as it is
 * while it is today's. When it is from another day, or missing (a fresh
 * device, a demo reset), the model loads once and works it out again; the
 * same when the day rolls over. Returns a function that stops it.
 */
function keepTodaysMenu(): () => void {
  let gone = false;
  let loading = false;
  const freshen = () => {
    if (loading || menuEditsStore.get().live?.date === isoDay(new Date(now()))) return;
    loading = true;
    void loadMenuModel()
      .then((m) => {
        if (!gone) m.freshenLiveMenu();
      })
      .finally(() => {
        loading = false;
      });
  };
  freshen();
  const off = menuEditsStore.subscribe(freshen);
  const timer = setInterval(freshen, 30_000);
  return () => {
    gone = true;
    off();
    clearInterval(timer);
  };
}

/**
 * Keeps the floor's menu on each venue's menu cycle with nobody editing in
 * Back Office: today's cycle day (and so the specials) follows each venue's
 * "Week 1 started" and changes when the day rolls over. The menu model loads
 * on its own, after the screen, and only where it is needed.
 */
function LiveMenu() {
  const { mode } = useRoute();
  const full = MENU_MODEL_SURFACES.has(mode);
  useEffect(() => {
    if (import.meta.env.MODE === 'test') return;
    if (!full) return keepTodaysMenu();
    let stop: (() => void) | undefined;
    let gone = false;
    void loadMenuModel().then((m) => {
      if (!gone) stop = m.keepLiveMenu();
    });
    return () => {
      gone = true;
      stop?.();
    };
  }, [full]);
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
