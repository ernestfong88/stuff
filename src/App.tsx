import { Suspense } from 'react';
import { Providers } from './app/Providers';
import { ErrorBoundary } from './shell/ErrorBoundary';
import { getMode, modeOn, modePhase } from './shell/modes';
import { PhaseOff } from './shell/PhaseOff';
import { useShared } from './lib/sharedStore';
import { layoutStore } from './store/layoutStore';
import { usePhaseOn, usePhasePlan } from './store/phases';
import { useRoute } from './shell/router';
import { useSignedIn } from './shell/session';
import { SignIn } from './shell/SignIn';
import { TouchLock } from './shell/TouchLock';
import { NEEDS_SIGN_IN, SURFACES } from './surfaces/registry';
import { Toaster } from './ui';

function Loading() {
  return <div style={{ position: 'fixed', inset: 0, background: 'var(--paper)' }} aria-busy="true" />;
}

export function App() {
  const { mode } = useRoute();
  const signedIn = useSignedIn();
  const Surface = SURFACES[mode];
  const m = getMode(mode);
  const gated = NEEDS_SIGN_IN.has(mode) && !signedIn;
  const plan = usePhasePlan();
  const off = !modeOn(m.id, plan, usePhaseOn());
  // Table names and venues come from the saved floor plans (getTable, inVenue): redraw when a layout is saved.
  useShared(layoutStore);
  return (
    <Providers>
      <div className={m.device === 'desktop' ? undefined : 'no-select'} data-mode={mode} style={{ height: '100%' }}>
        <ErrorBoundary resetKey={mode}>
          <Suspense fallback={<Loading />}>
            {off ? <PhaseOff label={m.label} phase={modePhase(m.id, plan)} /> : gated ? <SignIn /> : <Surface />}
          </Suspense>
        </ErrorBoundary>
        <TouchLock />
        <Toaster />
      </div>
    </Providers>
  );
}
