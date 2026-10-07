import { Plus } from 'lucide-react';
import { uid } from '../../../../lib/id';
import { Button } from '../../../../ui';
import { rooms, venueFees } from '../../../../data';
import { BoCallout, BoPage, CrudTable, setBillingList, useBilling, useCrudEditing, type CrudColumn } from '../../kit';
import { RetiredList } from '../RetiredList';
import type { BoPageProps } from '../../nav';
import type { DeliveryOption } from '../../seed/billing';
import { CorkageSettings } from './CorkageSettings';
import { SickWaiverSettings } from './SickWaiverSettings';
import s from './fees.module.css';

const COLUMNS: Array<CrudColumn<DeliveryOption>> = [
  { key: 'text', header: 'Option', render: (d) => <span className={s.name}>{d.text}</span>, editor: { kind: 'text', key: 'text' } },
  { key: 'amt', header: 'Fee', width: 200, render: (d) => (d.amt > 0 ? `$${d.amt.toFixed(2)}` : 'No charge'), editor: { kind: 'number', key: 'amt', prefix: '$', step: 0.5 } },
];

/** Delivery fees: room service and tray fees, and sick fee waivers (a tab of Pick Up & Delivery). */
export default function DeliveryFeesTab(_props: Partial<BoPageProps>) {
  const { deliveryOptions } = useBilling();
  const editing = useCrudEditing<DeliveryOption>();
  const standard = Object.entries(venueFees)
    .map(([k, f]) => `${rooms[k]?.name ?? k} $${f.delivery}`)
    .join(', ');
  return (
    <BoPage
      title="Delivery fees"
      actions={
        <Button variant="primary" icon={<Plus size={15} />} disabled={editing.draft != null} onClick={() => editing.add({ id: uid('df'), text: 'New option', amt: 0, isDefault: false, active: true })}>
          Add a fee
        </Button>
      }
    >
      <BoCallout tone="warning" title="Checkout doesn't use the fee list yet">
        The tablets and the kiosk charge each venue&apos;s standard delivery fee ({standard}). Changes to the list are saved and used once billing is connected.
        Sick waivers below already work on the floor.
      </BoCallout>
      <CrudTable noun="option" rows={deliveryOptions} setRows={(fn) => setBillingList('deliveryOptions', fn)} columns={COLUMNS} editing={editing} />
      <RetiredList noun="fee" rows={deliveryOptions} setRows={(fn) => setBillingList('deliveryOptions', fn)} />
      <SickWaiverSettings />
    </BoPage>
  );
}

/** Corkage: the per-bottle fee for wine a resident brings in (a tab of Meal Plans). */
export function CorkageTab() {
  return (
    <BoPage title="Corkage">
      <CorkageSettings />
    </BoPage>
  );
}
