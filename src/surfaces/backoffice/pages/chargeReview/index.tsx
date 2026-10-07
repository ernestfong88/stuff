import { useState } from 'react';
import { BadgeCheck, Ban, Check, MoreVertical, Pencil, Plus, RotateCcw, Send, Undo2 } from 'lucide-react';
import { getResident } from '../../../../data';
import { now } from '../../../../lib/clock';
import { Button, MenuItem, Popover, Tabs, cx, toast, useConfirm } from '../../../../ui';
import { BoPage, BoTable, setBillingList, useBilling, useResidentRecords, type BoColumn } from '../../kit';
import type { BoPageProps } from '../../nav';
import { BACK_OFFICE_USER } from '../../seed/associates';
import type { Charge } from '../../seed/billing';
import { approveAll, chargeStep, chargesFor, itemLabel, sendToBilling, toggleApproval, type ChargeTab } from './charges';
import { EditAmountModal } from './EditAmountModal';
import { ManualChargeModal } from './ManualChargeModal';
import s from './chargeReview.module.css';

const dateText = (t: number) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const shortDate = (t: number) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const HOW: Record<ChargeTab, string> = {
  review: 'Check each charge, then Approve it. Void one that should not be billed; you can bring it back. Approved charges move to Ready for billing.',
  final: 'Approved charges waiting to go to billing. Send them when the list looks right; after that they can no longer be changed.',
  recent: 'Every charge from the last 60 days, at whatever step it is.',
};

/** Charge Approval: review apartment charges before they go to billing. */
export default function ChargeApprovalPage(_props: BoPageProps) {
  const { charges } = useBilling();
  const residents = useResidentRecords();
  const [ask, dialog] = useConfirm();
  const [tab, setTab] = useState<ChargeTab>('review');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Charge | null>(null);
  const nameOf = (rid: string) => residents.find((r) => r.id === rid)?.name ?? getResident(rid)?.name ?? 'Unknown resident';
  const rows = chargesFor(tab, charges, now());
  const waiting = chargesFor('review', charges, now()).filter((c) => c.active);
  const ready = chargesFor('final', charges, now());
  const setCharges = (fn: (list: Charge[]) => Charge[]) => setBillingList('charges', fn);
  const patch = (id: string, fn: (c: Charge) => Charge) => setCharges((list) => list.map((x) => (x.id === id ? fn(x) : x)));
  const what = (c: Charge) => `${nameOf(c.residentId)}'s ${itemLabel(c.item).toLowerCase()} charge`;

  const setActive = (c: Charge, active: boolean) => {
    patch(c.id, (x) => ({ ...x, active }));
    if (!active) toast(`Voided ${what(c)}`, { action: { label: 'Undo', onClick: () => setActive(c, true) } });
    else toast(`Brought back ${what(c)}`, { tone: 'success' });
  };
  const approve = (c: Charge) => {
    patch(c.id, (x) => toggleApproval(x, BACK_OFFICE_USER.short, now()));
    const on = !c.approvedAt;
    toast(on ? `Approved ${what(c)}. It is now ready for billing.` : `Took back the approval. ${nameOf(c.residentId)}'s charge is waiting for review again.`, {
      tone: on ? 'success' : undefined,
      action: { label: 'Undo', onClick: () => patch(c.id, () => c) },
    });
  };
  const approveEverything = () => {
    const ids = new Set(waiting.map((c) => c.id));
    setCharges((list) => approveAll(list, BACK_OFFICE_USER.short, now()));
    toast(`Approved ${ids.size} ${ids.size === 1 ? 'charge' : 'charges'}`, {
      tone: 'success',
      action: { label: 'Undo', onClick: () => setCharges((list) => list.map((x) => (ids.has(x.id) ? { ...x, approvedAt: null, approvedBy: null } : x))) },
    });
  };
  const send = async () => {
    const total = ready.reduce((sum, c) => sum + c.amount, 0);
    const ok = await ask({
      title: `Send ${ready.length} ${ready.length === 1 ? 'charge' : 'charges'} to billing?`,
      message: `$${total} goes on residents' accounts. Once sent, a charge can no longer be changed or voided here.`,
      confirmLabel: 'Send to billing',
    });
    if (!ok) return;
    setCharges((list) => sendToBilling(list, now()));
    toast(`${ready.length} ${ready.length === 1 ? 'charge' : 'charges'} sent to billing`, { tone: 'success' });
  };

  const columns: Array<BoColumn<Charge>> = [
    {
      key: 'resident',
      header: 'Resident',
      render: (c) => (
        <span className={s.resident}>
          <span className={cx(s.name, !c.active && s.voided)}>{nameOf(c.residentId)}</span>
          {c.level && <span className={s.level}>{c.level}</span>}
        </span>
      ),
    },
    { key: 'date', header: 'Date', render: (c) => <span className={s.nowrap}>{dateText(c.date)}</span> },
    {
      key: 'desc',
      header: 'For',
      render: (c) => (
        <span className={s.for}>
          <span className={s.item}>{itemLabel(c.item)}</span>
          <span className={s.desc}>{c.desc}</span>
        </span>
      ),
    },
    { key: 'amount', header: 'Amount', align: 'right', width: 80, render: (c) => <span className={cx(s.amount, !c.active && s.voided)}>${c.amount}</span> },
    { key: 'status', header: 'Status', render: (c) => <Status c={c} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: 170,
      render: (c) => {
        const step = chargeStep(c);
        if (step === 'sent') return null;
        return (
          <span className={s.actions}>
            {step === 'waiting' && (
              <Button size="sm" variant="primary" icon={<Check size={14} />} onClick={() => approve(c)} aria-label={`Approve ${what(c)}`}>
                Approve
              </Button>
            )}
            {step === 'voided' && (
              <Button size="sm" icon={<RotateCcw size={14} />} onClick={() => setActive(c, true)} aria-label={`Bring back ${what(c)}`}>
                Bring back
              </Button>
            )}
            {step === 'approved' && (
              <Button size="sm" variant="ghost" icon={<Undo2 size={14} />} onClick={() => approve(c)} aria-label={`Take back the approval of ${what(c)}`}>
                Take back
              </Button>
            )}
            {step !== 'voided' && (
              <Popover trigger={({ toggle }) => <Button size="sm" variant="ghost" iconOnly icon={<MoreVertical size={16} />} aria-label={`More for ${what(c)}`} onClick={toggle} />} minWidth={200}>
                {({ close }) => (
                  <>
                    <MenuItem
                      icon={<Pencil size={15} />}
                      onClick={() => {
                        close();
                        setEditing(c);
                      }}
                    >
                      Change the amount
                    </MenuItem>
                    <MenuItem
                      danger
                      icon={<Ban size={15} />}
                      onClick={() => {
                        close();
                        setActive(c, false);
                      }}
                    >
                      Void this charge
                    </MenuItem>
                  </>
                )}
              </Popover>
            )}
          </span>
        );
      },
    },
  ];

  return (
    <BoPage
      title="Charge Approval"
      actions={
        <>
          <Button icon={<Plus size={15} />} onClick={() => setAdding(true)}>
            Add a charge
          </Button>
          {tab === 'review' && (
            <Button variant="primary" icon={<BadgeCheck size={15} />} disabled={!waiting.length} onClick={approveEverything}>
              {waiting.length ? `Approve all ${waiting.length}` : 'Approve all'}
            </Button>
          )}
          {tab === 'final' && (
            <Button variant="primary" icon={<Send size={15} />} disabled={!ready.length} onClick={() => void send()}>
              {ready.length ? `Send ${ready.length} to billing` : 'Send to billing'}
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
          { id: 'review', label: 'To review', count: waiting.length, countTone: waiting.length ? 'info' : 'neutral' },
          { id: 'final', label: 'Ready for billing', count: ready.length },
          { id: 'recent', label: 'Last 60 days' },
        ]}
      />
      <p className={s.how}>{HOW[tab]}</p>
      <BoTable
        caption="Charges"
        columns={columns}
        rows={rows}
        rowKey={(c) => c.id}
        rowTone={(c) => (c.active ? undefined : 'muted')}
        empty={tab === 'review' ? 'Nothing waiting. All caught up.' : tab === 'final' ? 'Nothing approved is waiting to go to billing.' : 'No charges in the last 60 days.'}
      />
      {adding && <ManualChargeModal onClose={() => setAdding(false)} />}
      {editing && <EditAmountModal charge={editing} residentName={nameOf(editing.residentId)} onClose={() => setEditing(null)} />}
      {dialog}
    </BoPage>
  );
}

/** Where a charge is, in words. */
function Status({ c }: { c: Charge }) {
  const step = chargeStep(c);
  if (step === 'sent') return <span className={s.sent}>Sent to billing {shortDate(c.importedAt!)}</span>;
  if (step === 'voided') return <span className={s.muted}>Voided</span>;
  if (step === 'approved')
    return (
      <span className={s.approved}>
        Approved{c.approvedBy ? ` by ${c.approvedBy}` : ''}
        {c.approvedAt ? `, ${shortDate(c.approvedAt)}` : ''}
      </span>
    );
  return <span className={s.waiting}>Waiting for review</span>;
}
