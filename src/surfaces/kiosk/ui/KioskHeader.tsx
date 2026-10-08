import { Sun } from 'lucide-react';
import { COMMUNITY_NAME } from '../../../data';
import s from './KioskHeader.module.css';

/** Community name, and "Step 3 of 12" with a progress bar once the questions start. */
export function KioskHeader({ step, of }: { step: number; of: number }) {
  return (
    <header className={s.header}>
      <div className={s.brand}>
        <span className={s.logo} aria-hidden>
          <Sun size="58%" strokeWidth={2} />
        </span>
        <span className={s.names}>
          <span className={s.community}>{COMMUNITY_NAME}</span>
          <span className={s.dining}>Dining</span>
        </span>
      </div>
      {step > 0 && (
        <div className={s.progress} role="progressbar" aria-valuemin={1} aria-valuemax={of} aria-valuenow={step} aria-label={`Step ${step} of ${of}`}>
          <div className={s.count}>
            Step {step} of {of}
          </div>
          <div className={s.track}>
            <div className={s.bar} style={{ width: `${Math.round((step / of) * 100)}%` }} />
          </div>
        </div>
      )}
    </header>
  );
}
