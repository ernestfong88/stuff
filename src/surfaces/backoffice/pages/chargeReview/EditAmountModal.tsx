import { useState } from 'react';
import { Save } from 'lucide-react';
import { Button, Modal, toast } from '../../../../ui';
import { BoField, setBillingList } from '../../kit';
import type { Charge } from '../../seed/billing';
import s from './chargeReview.module.css';

/** Correct the amount of a charge before it is imported. */
export function EditAmountModal({ charge, residentName, onClose }: { charge: Charge; residentName: string; onClose: () => void }) {
  const [amount, setAmount] = useState(String(charge.amount));
  const value = Number(amount);
  const valid = amount !== '' && Number.isFinite(value) && value >= 0;
  const save = () => {
    setBillingList('charges', (list) => list.map((c) => (c.id === charge.id ? { ...c, amount: value } : c)));
    toast('Amount updated', { tone: 'success' });
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit amount · ${residentName}`}
      subtitle={charge.desc}
      width={420}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon={<Save size={15} />} disabled={!valid} onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <BoField label="Amount">
        {(id) => (
          <span className={s.moneyInput}>
            <span>$</span>
            <input id={id} type="number" min={0} step={0.5} value={amount} onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && valid && save()} />
          </span>
        )}
      </BoField>
    </Modal>
  );
}
