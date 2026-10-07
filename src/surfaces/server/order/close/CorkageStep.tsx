import { corkageSettings } from '../../../../domain/billing';
import type { Order } from '../../../../domain/types';
import { useConfig } from '../../../../store/config';
import { useDining } from '../../../../store/dining';
import { Minus, Plus } from 'lucide-react';
import s from './CorkageStep.module.css';

/**
 * Corkage is a check-level charge set per venue, like the delivery and pick
 * up fees, never a menu item. The server counts bottles when closing and
 * the charge lands on seat 1.
 */
export function CorkageStep({ order: o }: { order: Order }) {
  const cfg = useConfig();
  const { setCorkage } = useDining();
  const c = corkageSettings(o.room, cfg);
  const bottles = o.corkage || 0;
  if (!c.on || o.queueType) return null;
  return (
    <div className={s.row}>
      <span className={s.label}>
        Corkage fee <span className={s.sub}>· ${c.amt} a bottle, charged to seat 1</span>
      </span>
      <button className={s.step} aria-label="Fewer bottles" disabled={bottles <= 0} onClick={() => setCorkage(o.id, bottles - 1)}>
        <Minus size={16} strokeWidth={2.5} aria-hidden />
      </button>
      <span className={s.count} aria-live="polite">
        {bottles ? `${bottles} ${bottles === 1 ? 'bottle' : 'bottles'}` : 'None'}
      </span>
      <button className={s.step} aria-label="More bottles" onClick={() => setCorkage(o.id, bottles + 1)}>
        <Plus size={16} strokeWidth={2.5} aria-hidden />
      </button>
    </div>
  );
}
