import { Plus } from 'lucide-react';
import { uid } from '../../../../lib/id';
import { Button } from '../../../../ui';
import { BoPage, CrudTable, setBillingList, useBilling, useCrudEditing, type CrudColumn } from '../../kit';
import type { BoPageProps } from '../../nav';
import type { DeliveryOption } from '../../seed/billing';
import { CorkageSettings } from './CorkageSettings';
import { SickWaiverSettings } from './SickWaiverSettings';
import s from './fees.module.css';

const COLUMNS: Array<CrudColumn<DeliveryOption>> = [
  { key: 'text', header: 'Option', render: (d) => <span className={s.name}>{d.text}</span>, editor: { kind: 'text', key: 'text' } },
  { key: 'amt', header: 'Fee', width: 200, render: (d) => (d.amt > 0 ? `$${d.amt.toFixed(2)}` : 'No charge'), editor: { kind: 'number', key: 'amt', prefix: '$', step: 0.5 } },
];

/** Delivery Options: room service and tray fees, corkage, sick fee waivers. */
export default function DeliveryOptionsPage(_props: BoPageProps) {
  const { deliveryOptions } = useBilling();
  const editing = useCrudEditing<DeliveryOption>();
  return (
    <BoPage
      title="Delivery Options"
      sub="Room service and tray fees. Retiring an option keeps it on closed checks, so they never lose their fee description."
      actions={
        <Button variant="primary" icon={<Plus size={15} />} disabled={editing.draft != null} onClick={() => editing.add({ id: uid('df'), text: 'New option', amt: 0, isDefault: false, active: true })}>
          Add
        </Button>
      }
    >
      <CrudTable noun="option" rows={deliveryOptions} setRows={(fn) => setBillingList('deliveryOptions', fn)} columns={COLUMNS} editing={editing} />
      <CorkageSettings />
      <SickWaiverSettings />
    </BoPage>
  );
}
