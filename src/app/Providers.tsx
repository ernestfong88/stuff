import { useEffect, type ReactNode } from 'react';
import { useRoute } from '../shell/router';
import { useSignedIn } from '../shell/session';
import { registerDemoAction } from '../shell/demoTools';
import { DiningProvider, useDining } from '../store/dining';
import { setSessionMode, setSignedIn } from '../store/session';

/** Tells the dining store which surface this tab is and who is signed in (for check timelines and takeovers). */
function SessionBridge() {
  const { mode } = useRoute();
  const me = useSignedIn();
  useEffect(() => setSessionMode(mode), [mode]);
  useEffect(() => setSignedIn(me?.initials ?? null), [me]);
  return null;
}

/** Demo tools, at the bottom of the screen menu on every screen. */
function DemoTools() {
  const { resetDemo, clearAll } = useDining();
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

/** App-wide providers. */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <DiningProvider>
      <SessionBridge />
      <DemoTools />
      {children}
    </DiningProvider>
  );
}
