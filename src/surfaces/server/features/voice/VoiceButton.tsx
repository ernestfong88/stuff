import { useState } from 'react';
import { Mic } from 'lucide-react';
import { leadDiner, tableName } from '../../../../domain/orders';
import type { Order } from '../../../../domain/types';
import { useDining } from '../../../../store/dining';
import { Avatar, Button, Sheet } from '../../../../ui';
import { RailButton } from '../shared/RailButton';
import { tableResidents } from '../shared/tablePeople';
import { useMyInitials } from '../shared/useShiftServers';
import { VoiceSheet } from './VoiceSheet';
import s from './VoiceButton.module.css';

/** Rail button that opens voice notes for one of the server's open tables. */
export function VoiceButton() {
  const me = useMyInitials();
  const { orders } = useDining();
  const [step, setStep] = useState<'closed' | 'pick' | string>('closed');
  const mine = orders.filter((o) => o.server === me && !o.queueType);
  const picked = step !== 'closed' && step !== 'pick' ? mine.find((o) => o.id === step) : undefined;
  return (
    <>
      <RailButton
        icon={<Mic size={24} strokeWidth={2} aria-hidden />}
        label="Voice"
        onClick={() => setStep('pick')}
        title="Voice note about one of your tables"
        ariaLabel="Voice note about one of your tables"
      />
      {step === 'pick' && (
        <Sheet
          open
          side="bottom"
          className={s.sheet}
          onClose={() => setStep('closed')}
          title="Which table is this about?"
          subtitle="Pick the table, then say what you learned or noticed."
        >
          {mine.length ? (
            <div className={s.grid}>
              {mine.map((o) => (
                <TableChoice key={o.id} order={o} onPick={() => setStep(o.id)} />
              ))}
            </div>
          ) : (
            <p className={s.empty}>You have no open tables right now.</p>
          )}
        </Sheet>
      )}
      {picked && <VoiceSheet order={picked} onClose={() => setStep('closed')} onBack={() => setStep('pick')} />}
    </>
  );
}

function TableChoice({ order, onPick }: { order: Order; onPick: () => void }) {
  const residents = tableResidents(order);
  const lead = leadDiner(order);
  return (
    <button type="button" className={s.choice} onClick={onPick}>
      <span className={s.faces}>
        {residents.length ? (
          residents.slice(0, 3).map((r) => <Avatar key={r.id} person={r} size={34} className={s.face} />)
        ) : (
          <span className={s.blank} />
        )}
      </span>
      <span className={s.text}>
        <span className={s.table}>{tableName(order)}</span>
        <span className={s.who}>{lead ? lead.name + (lead.more ? ` +${lead.more}` : '') : 'No diners yet'}</span>
      </span>
    </button>
  );
}

/** Mic button for one check (order screen): voice notes about that table. */
export function MicButton({ order }: { order: Order }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="secondary"
        iconOnly
        size="lg"
        className={s.mic}
        aria-label="Voice note"
        title="Voice note: what you learned or noticed about this table"
        icon={<Mic size={18} />}
        onClick={() => setOpen(true)}
      />
      {open && <VoiceSheet order={order} onClose={() => setOpen(false)} />}
    </>
  );
}
