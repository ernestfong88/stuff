import { useState } from 'react';
import { Plus } from 'lucide-react';
import { uid } from '../../../../lib/id';
import { now } from '../../../../lib/clock';
import { Button, Modal, toast } from '../../../../ui';
import { BoField, BoSelect, setBillingList, useResidentRecords } from '../../kit';
import s from './chargeReview.module.css';

/** Add a charge by hand (a private dining room, a catering order ...). It waits for review like any other. */
export function ManualChargeModal({ onClose }: { onClose: () => void }) {
  const residents = useResidentRecords();
  const [residentId, setResidentId] = useState(residents[0]?.id ?? '');
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const value = Number(amount);
  const valid = desc.trim() !== '' && amount !== '' && value > 0;
  const add = () => {
    const res = residents.find((r) => r.id === residentId);
    setBillingList('charges', (list) => [
      {
        id: uid('c'),
        residentId,
        level: res?.level ?? '',
        date: now(),
        item: 'MANUAL',
        desc: desc.trim(),
        amount: value,
        active: true,
        approvedAt: null,
        approvedBy: null,
        importedAt: null,
        source: 'manual',
      },
      ...list,
    ]);
    toast('Manual charge added. It is waiting for review.', { tone: 'success' });
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Manual charge"
      width={460}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon={<Plus size={15} />} disabled={!valid} onClick={add}>
            Add charge
          </Button>
        </>
      }
    >
      <div className={s.form}>
        <BoField label="Resident">
          {(id) => (
            <BoSelect id={id} value={residentId} onChange={(e) => setResidentId(e.target.value)}>
              {residents.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} · Apt {r.apt}
                </option>
              ))}
            </BoSelect>
          )}
        </BoField>
        <BoField label="Description">
          {(id) => <input id={id} className={s.text} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Private dining room rental" />}
        </BoField>
        <BoField label="Amount">
          {(id) => (
            <span className={s.moneyInput}>
              <span>$</span>
              <input id={id} type="number" min={0} step={0.5} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
            </span>
          )}
        </BoField>
      </div>
    </Modal>
  );
}
