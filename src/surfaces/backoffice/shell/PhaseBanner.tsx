import { Lock, Milestone } from 'lucide-react';
import { cx } from '../../../ui';
import { phaseIsOn, phaseOf, usePhaseOn, usePhasePlan, type Phase } from '../phases';
import s from './PhaseBanner.module.css';

/**
 * A strip above a Phase 2 or Phase 3 page, so nobody mistakes it for something
 * in the first release. It links nowhere: Release Phases is a Home Office setting.
 */
export function PhaseBanner({ pageId }: { pageId: string }) {
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
    </div>
  );
}

/** In place of a page whose phase is switched off. No switch or link: Home Office decides the phases. */
export function PhaseOffPage({ phase }: { phase: Phase }) {
  return (
    <div className={cx(s.off, phase === 3 && s.three)} role="note">
      <Milestone size={26} className={s.icon} aria-hidden />
      <h1 className={s.offTitle}>Not available yet</h1>
      <p className={s.offBody}>This page is part of Phase {phase}, so it is hidden and what it sets up is not in use yet.</p>
    </div>
  );
}

/** In place of an HO Settings page for anyone not signed in as Home Office. */
export function HomeOfficeOnlyPage() {
  return (
    <div className={cx(s.off, s.ho)} role="note">
      <Lock size={26} className={s.icon} aria-hidden />
      <h1 className={s.offTitle}>This page is for Home Office</h1>
      <p className={s.offBody}>Home Office manages these settings for every community.</p>
    </div>
  );
}
