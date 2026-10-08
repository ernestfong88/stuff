import { Truck } from 'lucide-react';
import { pickupApt } from '../../../domain/pickup';
import { firstOf, runTextNote, type QueueRow } from '../queue/queue';
import type { TextContext } from '../../../domain/pickupService/texts';
import s from './DeliveryRun.module.css';

/** Two or more deliveries ready at once: suggest one trip, with one button. */
export function DeliveryRun({ runs, ctx, onTakeAll }: { runs: QueueRow[]; ctx: TextContext; onTakeAll: () => void }) {
  const names = runs
    .map((r) => {
      const apt = pickupApt(r.order);
      return firstOf(r.order) + (apt ? ` (Apt ${apt})` : '');
    })
    .join(', ');
  return (
    <section className={s.run} aria-label="Deliveries ready together">
      <Truck size={22} strokeWidth={2.25} className={s.icon} aria-hidden />
      <div className={s.text}>
        <div className={s.title}>{runs.length} deliveries are ready. Take them in one trip.</div>
        <div className={s.detail}>
          {names}. {runTextNote(runs, ctx)}
        </div>
      </div>
      <button className={s.take} onClick={onTakeAll}>
        <Truck size={14} strokeWidth={2.5} aria-hidden />
        Take all {runs.length}
      </button>
    </section>
  );
}
