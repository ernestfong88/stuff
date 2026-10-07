import { Milestone } from 'lucide-react';
import { CornerControls } from './controls';
import { navigate } from './router';
import s from './PhaseOff.module.css';

/** What a screen shows while its release phase is switched off. */
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
      <p className={s.body}>
        Phase {phase} is switched off, so this screen isn't in use yet. Pick another screen from the menu in the corner, or switch Phase {phase} on in
        Back Office, Release Phases.
      </p>
      <button className={s.btn} onClick={() => navigate('backoffice', ['phases'])}>
        Open Release Phases
      </button>
    </div>
  );
}
