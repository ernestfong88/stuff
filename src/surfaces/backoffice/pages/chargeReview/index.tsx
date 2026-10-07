import { useState } from 'react';
import { BadgeCheck, Check, Pencil, Plus } from 'lucide-react';
import { now } from '../../../../lib/clock';
import { Button, Chip, Tabs, cx, toast } from '../../../../ui';
import { BoIconButton, BoPage, BoTable, setBillingList, useBilling, useResidentRecords, type BoColumn } from '../../kit';
import type { BoPageProps } from '../../nav';
import { BACK_OFFICE_USER } from '../../seed/associates';
import type { Charge } from '../../seed/billing';
import { approveAll, chargesFor, toggleApproval, type ChargeTab } from './charges';
import { EditAmountModal } from './EditAmountModal';
import { ManualChargeModal } from './ManualChargeModal';
import s from './chargeReview.module.css';

const dateText = (t: number) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/** Charge Approval: review apartment charges before they go to billing. */
export default function ChargeApprovalPage(_props: BoPageProps) {
  const { charges } = useBilling();
  const residents = useResidentRecords();
  const [tab, setTab] = useState<ChargeTab>('review');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Charge | null>(null);
  const nameOf = (rid: string) => residents.find((r) => r.id === rid)?.name ?? 'Unknown resident';
  const rows = chargesFor(tab, charges, now());
  const waiting = chargesFor('review', charges, now()).length;
  const setCharges = (fn: (list: Charge[]) => Charge[]) => setBillingList('charges', fn);

  const setActive = (c: Charge, active: boolean) => {
    setCharges((list) => list.map((x) => (x.id === c.id ? { ...x, active } : x)));
    if (!active) toast('Charge voided', { action: { label: 'Undo', onClick: () => setActive(c, true) } });
    else toast('Charge reinstated', { tone: 'success' });
  };

  const columns: Array<BoColumn<Charge>> = [
    {
      key: 'resident',
      header: 'Resident',
      render: (c) => (
        <span className={s.resident}>
          <span className={cx(s.name, !c.active && s.voided)}>{nameOf(c.residentId)}</span>
          <span className={s.level}>{c.level}</span>
        </span>
      ),
    },
    { key: 'date', header: 'Date', render: (c) => <span className={s.nowrap}>{dateText(c.date)}</span> },
    { key: 'item', header: 'Item', render: (c) => <Chip size="xs">{c.item}</Chip> },
    { key: 'desc', header: 'Description', render: (c) => c.desc },
    { key: 'amount', header: 'Amount', align: 'right', width: 80, render: (c) => <span className={s.amount}>${c.amount}</span> },
    {
      key: 'active',
      header: 'Active',
      align: 'center',
      width: 70,
      render: (c) => (
        <input type="checkbox" className={s.check} checked={c.active} disabled={!!c.importedAt} aria-label={`${c.active ? 'Void' : 'Reinstate'} ${nameOf(c.residentId)}'s ${c.item} charge`} onChange={(e) => setActive(c, e.target.checked)} />
      ),
    },
    {
      key: 'reviewed',
      header: 'Reviewed',
      align: 'center',
      render: (c) =>
        c.importedAt ? (
          <Check size={15} className={s.done} aria-label="Reviewed" />
        ) : (
          <span className={s.reviewed}>
            <input
              type="checkbox"
              className={s.check}
              checked={!!c.approvedAt}
              disabled={!c.active}
              aria-label={`Approve ${nameOf(c.residentId)}'s ${c.item} charge`}
              onChange={() => setCharges((list) => list.map((x) => (x.id === c.id ? toggleApproval(x, BACK_OFFICE_USER.short, now()) : x)))}
            />
            {c.approvedBy && <span className={s.by}>{c.approvedBy}</span>}
          </span>
        ),
    },
    {
      key: 'imported',
      header: 'Imported',
      align: 'center',
      render: (c) => (c.importedAt ? <Chip tone="success" size="xs">{dateText(c.importedAt)}</Chip> : <span className={s.dash}>—</span>),
    },
    {
      key: 'edit',
      header: '',
      align: 'right',
      width: 56,
      render: (c) =>
        !c.importedAt && (
          <BoIconButton aria-label={`Edit the amount of ${nameOf(c.residentId)}'s ${c.item} charge`} onClick={() => setEditing(c)}>
            <Pencil size={14} />
          </BoIconButton>
        ),
    },
  ];

  return (
    <BoPage
      title="Charge Approval"
      sub="Apartment charges go from unapproved to approved to imported to billing. Voiding is separate and can be undone."
      actions={
        <>
          <Button icon={<Plus size={15} />} onClick={() => setAdding(true)}>
            Manual charge
          </Button>
          {tab === 'review' && (
            <Button
              variant="primary"
              icon={<BadgeCheck size={15} />}
              disabled={!rows.some((c) => c.active)}
              onClick={() => {
                setCharges((list) => approveAll(list, BACK_OFFICE_USER.short, now()));
                toast('All reviewed charges approved', { tone: 'success' });
              }}
            >
              Approve all
            </Button>
          )}
        </>
      }
    >
      <Tabs
        aria-label="Which charges"
        value={tab}
        onChange={setTab}
        options={[
          { id: 'review', label: `To be reviewed (${waiting})` },
          { id: 'final', label: 'Final billing review' },
          { id: 'recent', label: 'Last 60 days' },
        ]}
      />
      <BoTable
        caption="Charges"
        columns={columns}
        rows={rows}
        rowKey={(c) => c.id}
        rowTone={(c) => (c.active ? undefined : 'muted')}
        empty={tab === 'review' ? 'Nothing waiting. All caught up.' : tab === 'final' ? 'No approved charges waiting to import.' : 'No charges in the last 60 days.'}
      />
      {adding && <ManualChargeModal onClose={() => setAdding(false)} />}
      {editing && <EditAmountModal charge={editing} residentName={nameOf(editing.residentId)} onClose={() => setEditing(null)} />}
    </BoPage>
  );
}
