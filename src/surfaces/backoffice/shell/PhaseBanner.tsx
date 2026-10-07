import { Milestone } from 'lucide-react';
import { cx } from '../../../ui';
import { phaseOf, usePhasePlan } from '../phases';
import s from './PhaseBanner.module.css';

/** A strip above a Phase 2 or Phase 3 page, so nobody mistakes it for something in the first release. */
export function PhaseBanner({ pageId, goto }: { pageId: string; goto: (pageId: string) => void }) {
  const plan = usePhasePlan();
  const phase = phaseOf(pageId, plan);
  if (phase === 1) return null;
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
