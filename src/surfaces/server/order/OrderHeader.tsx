import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { rooms } from '../../../data';
import { tableName } from '../../../domain/orders';
import type { Order } from '../../../domain/types';
import { minutesSince, now } from '../../../lib/clock';
import { ModeChip, TextZoom } from '../../../shell/controls';
import { useDining } from '../../../store/dining';
import { MenuReferenceButton } from '../features';
import { CompDialog } from '../shared/ManagerPin';
import { MealSwitch } from './MealSwitch';
import s from './OrderHeader.module.css';

/** Back, which check this is, its meal, the menu reference and (pick up / delivery) a manager comp. */
export function OrderHeader({ order: o, onBack }: { order: Order; onBack: () => void }) {
  const { setOrderMeal, setOrderComp } = useDining();
  const [askComp, setAskComp] = useState(false);
  const title = o.queueType ? tableName(o) : `Table ${tableName(o)}`;
  return (
    <header className={s.header}>
      <button className={s.back} onClick={onBack}>
        <ChevronLeft size={19} strokeWidth={2.5} aria-hidden /> Back
      </button>
      <div className={s.titles}>
        <h1 className={s.title}>{title}</h1>
        <div className={s.sub}>
          {(rooms[o.room]?.name ?? o.room) + ' · ' + minutesSince(o.openedAt) + 'm · ' + o.server}
        </div>
      </div>
      <MealSwitch meal={o.meal} onChange={(m) => setOrderMeal(o.id, m)} />
      <MenuReferenceButton short />
      {o.queueType &&
        (o.comp ? (
          <span className={s.comped}>
            Comped · {o.comp.reason}
            <button className={s.undo} onClick={() => setOrderComp(o.id, null)}>
              undo
            </button>
          </span>
        ) : (
          <button className={s.comp} onClick={() => setAskComp(true)}>
            Manager comp…
          </button>
        ))}
      {askComp && (
        <CompDialog
          title="Comp this order?"
          onClose={() => setAskComp(false)}
          onApprove={(reason) => {
            setOrderComp(o.id, { reason, at: now() });
            setAskComp(false);
          }}
        />
      )}
      <span className={s.grow} />
      <TextZoom />
      <ModeChip />
    </header>
  );
}
