import { Utensils } from 'lucide-react';
import { KButton } from '../ui/KButton';
import type { KioskFlow } from '../useKioskFlow';
import s from './WelcomeStep.module.css';

export function WelcomeStep({ flow }: { flow: KioskFlow }) {
  return (
    <div className={s.welcome}>
      <span className={s.badge} aria-hidden>
        <Utensils size="52%" strokeWidth={1.8} />
      </span>
      <h1 className={s.title}>Order a meal to pick up or have delivered.</h1>
      <p className={s.sub}>Tap Start. We&rsquo;ll ask one question at a time.</p>
      <KButton look="primary" className={s.start} onClick={() => flow.go('apt', { typed: '', miss: false, by: 'phone' })}>
        Start
      </KButton>
    </div>
  );
}
