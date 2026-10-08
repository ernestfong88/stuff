import { Milestone } from 'lucide-react';
import { CornerControls } from './controls';
import s from './PhaseOff.module.css';

/**
 * What a screen shows while its release phase is switched off. No way into
 * Release Phases from here: that is a Home Office setting.
 */
export function PhaseOff({ label, phase }: { label: string; phase: number }) {
  return (
    <div className={s.wrap}>
      <CornerControls />
      <span className={s.icon}>
        <Milestone size={28} strokeWidth={1.6} />
      </span>
      <h1 className={s.title}>
        {label} is part of Phase {phase}
      </h1>
      <p className={s.body}>Not available yet. This screen comes in Phase {phase}. Pick another screen from the menu in the corner.</p>
    </div>
  );
}
