import { Milestone } from 'lucide-react';
import { cx } from '../../../ui';
import { phaseIsOn, phaseOf, setPhaseOn, usePhaseOn, usePhasePlan, type Phase } from '../phases';
import s from './PhaseBanner.module.css';

/** A strip above a Phase 2 or Phase 3 page, so nobody mistakes it for something in the first release. */
export function PhaseBanner({ pageId, goto }: { pageId: string; goto: (pageId: string) => void }) {
  const plan = usePhasePlan();
  const on = usePhaseOn();
  const phase = phaseOf(pageId, plan);
  if (phase === 1 || !phaseIsOn(phase, on)) return null;
  return (
    <div className={cx(s.banner, phase === 3 && s.three)} role="note">
      <Milestone size={16} className={s.icon} aria-hidden />
      <span className={s.text}>
        <strong>Phase {phase}.</strong> This page is planned for a later release, not the first one.
      </span>
      {pageId !== 'phases' && (
        <button className={s.link} onClick={() => goto('phases')}>
          Release Phases
        </button>
      )}
    </div>
  );
}

/** In place of a page whose phase is switched off. */
export function PhaseOffPage({ phase, goto }: { phase: Phase; goto: (pageId: string) => void }) {
  return (
    <div className={cx(s.off, phase === 3 && s.three)} role="note">
      <Milestone size={26} className={s.icon} aria-hidden />
      <h1 className={s.offTitle}>Phase {phase} is switched off</h1>
      <p className={s.offBody}>
        This page belongs to Phase {phase}, so it is hidden and what it sets up is not in use. Switch the phase on to use it.
      </p>
      <div className={s.offActions}>
        <button className={s.offBtn} onClick={() => setPhaseOn(phase, true)}>
          Switch Phase {phase} on
        </button>
        <button className={s.link} onClick={() => goto('phases')}>
          Release Phases
        </button>
      </div>
    </div>
  );
}
