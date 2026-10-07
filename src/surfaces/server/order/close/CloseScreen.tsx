import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, ChevronLeft, Printer } from 'lucide-react';
import { COMMUNITY_NAME } from '../../../../data';
import { automaticComp, isHospiceDiner } from '../../../../domain/waivers';
import { dinerName, dinerPerson, tableName } from '../../../../domain/orders';
import { queueFee } from '../../../../domain/billing';
import type { Order, Resident } from '../../../../domain/types';
import { ModeChip, TextZoom } from '../../../../shell/controls';
import { useConfig } from '../../../../store/config';
import { useDining } from '../../../../store/dining';
import { useSetting } from '../../../../store/serviceConfig';
import { cx } from '../../../../ui';
import { CompDialog } from '../../shared/ManagerPin';
import { CloseDinerCard } from './CloseDinerCard';
import { CloseSummary, CloseTotal } from './CloseParts';
import {
  chargeDrop,
  closeButtonLabel,
  closeCharge,
  closeView,
  creditUse,
  defaultDrop,
  defaultPlanMode,
  NO_CHARGE_DROPS,
  planUse,
  type CloseRow,
  type PayHow,
  type PlanMode,
  type TablePay,
} from './closeMath';
import { CorkageStep } from './CorkageStep';
import s from './CloseScreen.module.css';
import { TablePayment, type TerminalState } from './Payment';

/** How long "Printed" shows on a receipt button. */
const PRINTED_MS = 1800;

/** Communities where residents can put a guest's meal on their plan unless Back Office says otherwise. */
const GUEST_CREDIT_COMMUNITIES: readonly string[] = ['The Fountains'];

const cardRef = () => 'sq_' + Math.random().toString(36).slice(2, 7).toUpperCase();

/**
 * Close & charge: every person's meal plan use, comps, charges to the
 * apartment or a card at the terminal, and closing the whole table or just
 * some of the people at it (the rest stay open).
 */
export function CloseScreen({ order: o, dinerIds, onBack, onDone }: { order: Order; dinerIds: string[] | null; onBack: () => void; onDone: () => void }) {
  const cfg = useConfig();
  const { closeOrder, closeDiner } = useDining();
  const guestCreditOn = useSetting<boolean | undefined>(`guestCredit.${COMMUNITY_NAME}`) ?? GUEST_CREDIT_COMMUNITIES.includes(COMMUNITY_NAME);
  const [closing, setClosing] = useState<string[]>(() => dinerIds ?? o.diners.map((d) => d.id));
  const [printed, setPrinted] = useState<Record<string, boolean>>({});
  const [how, setHow] = useState<Record<string, PayHow>>({});
  const [terminal, setTerminal] = useState<Record<string, TerminalState>>({});
  const [tablePay, setTablePay] = useState<TablePay>('each');
  const [tableTerminal, setTableTerminal] = useState<Record<number, TerminalState>>({});
  const [split, setSplit] = useState(50);
  const [overflowChoice, setOverflowChoice] = useState<Record<string, 'credit' | 'ala'>>({});
  const [mode, setMode] = useState<Record<string, PlanMode>>(() => Object.fromEntries(o.diners.map((d) => [d.id, defaultPlanMode(d)])));
  const [compReason, setCompReason] = useState<Record<string, string>>({});
  const [guestOnHost, setGuestOnHost] = useState<Record<string, boolean>>({});
  const [feeComp, setFeeComp] = useState<{ reason: string } | null>(null);
  const [asking, setAsking] = useState<string | null>(null);
  const drop = Object.fromEntries(o.diners.map((d) => [d.id, defaultDrop(d, o)]));

  const printTimers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  useEffect(() => () => printTimers.current.forEach(clearTimeout), []);
  const print = (key: string) => {
    setPrinted((p) => ({ ...p, [key]: true }));
    printTimers.current.push(setTimeout(() => setPrinted((p) => ({ ...p, [key]: false })), PRINTED_MS));
  };

  const inputs = { order: o, mode, drop, overflowChoice, guestOnHost, guestCreditOn, feeComped: !!feeComp, cfg };
  const rows: CloseRow[] = o.diners
    .filter((d) => closing.includes(d.id))
    .map((d) => ({ diner: d, person: dinerPerson(d) as Resident | undefined, charge: closeCharge(d, inputs) }));
  const uses = o.diners.map((d) => creditUse(d, overflowChoice));
  const useOf = (id: string) => uses.find((u) => u?.diner.id === id) ?? null;
  const pu = planUse(rows, mode, uses);
  const howOf = (id: string): PayHow => how[id] ?? 'apt';
  const views = rows.map((r) =>
    closeView(r, o, {
      mode: mode[r.diner.id] ?? 'count',
      noCharge: NO_CHARGE_DROPS[drop[r.diner.id]] ?? null,
      how: howOf(r.diner.id),
      tablePay,
      credits: useOf(r.diner.id)?.credits,
      why: compReason[r.diner.id] || o.comp?.reason,
      pu: r.person ? pu[r.person.id] : undefined,
    }),
  );
  const total = rows.reduce((a, r) => a + r.charge.outOfPlan, 0);

  const cardWaiting =
    tablePay === 'each'
      ? rows.some((r) => r.charge.outOfPlan > 0 && howOf(r.diner.id) === 'card' && terminal[r.diner.id] !== 'paid')
      : tablePay === 'one'
        ? tableTerminal[0] !== 'paid'
        : tableTerminal[0] !== 'paid' || tableTerminal[1] !== 'paid';
  // Only a table with something to charge waits on the terminal.
  const blocked = cardWaiting && (tablePay === 'each' || total > 0);

  const finish = () => {
    const drops: Record<string, string> = {};
    for (const r of rows) {
      const reason = o.comp?.reason || compReason[r.diner.id] || (isHospiceDiner(r.diner, cfg) ? 'Hospice' : 'Manager choice');
      drops[r.diner.id] = chargeDrop(r, howOf(r.diner.id), reason, cardRef);
    }
    if (closing.length < o.diners.length) {
      for (const id of closing) closeDiner(o.id, id, drops[id]);
      onBack();
    } else {
      closeOrder(o.id, drops);
      onDone();
    }
  };

  const pickTablePay = (m: TablePay) => {
    setTablePay(m);
    setTableTerminal({});
    const charged = rows.filter((r) => r.charge.outOfPlan > 0).map((r) => r.diner.id);
    setHow((h) => {
      const next = { ...h };
      for (const id of charged) {
        if (m === 'each') delete next[id];
        else next[id] = 'card';
      }
      return next;
    });
  };

  const fee = queueFee(o, cfg);
  const place = o.tableId ? `Table ${tableName(o)}` : tableName(o);

  return (
    <div className={s.screen}>
      {asking && (
        <CompDialog
          title={asking === 'fee' ? `Comp the ${fee.kind?.toLowerCase() ?? 'fee'}?` : 'Comp this diner?'}
          free={asking === 'fee' ? automaticComp(o, cfg) : null}
          onClose={() => setAsking(null)}
          onApprove={(reason) => {
            if (asking === 'fee') setFeeComp({ reason });
            else {
              setMode((m) => ({ ...m, [asking]: 'comp' }));
              setCompReason((c) => ({ ...c, [asking]: reason }));
            }
            setAsking(null);
          }}
        />
      )}
      <header className={s.header}>
        <button className={s.back} onClick={onBack}>
          <ChevronLeft size={18} aria-hidden /> Check
        </button>
        <div className={s.titles}>
          <h1 className={s.title}>Close &amp; charge</h1>
          <div className={s.sub}>
            {place} · {o.meal}
          </div>
        </div>
        <span className={s.corner}>
          <TextZoom />
          <ModeChip />
        </span>
      </header>

      {o.diners.length > 1 && (
        <div className={s.closingNow}>
          <span className={s.eyebrow}>Closing now</span>
          {o.diners.map((d) => {
            const on = closing.includes(d.id);
            return (
              <button
                key={d.id}
                className={cx(s.who, on && s.whoOn)}
                aria-pressed={on}
                onClick={() => setClosing((c) => (on ? (c.length > 1 ? c.filter((x) => x !== d.id) : c) : [...c, d.id]))}
              >
                {on && <Check size={13} strokeWidth={3} aria-hidden />}
                {dinerName(d).split(' ')[0]}
              </button>
            );
          })}
          <span className={s.hint}>{closing.length < o.diners.length ? 'The rest stay open at the table.' : 'Whole table.'}</span>
        </div>
      )}
      <CorkageStep order={o} />

      <div className={cx(s.scroll, 'scroll')}>
        {rows.length > 1 && <CloseSummary rows={rows} views={views} total={total} />}
        {rows.map((r, i) => {
          const id = r.diner.id;
          return (
            <CloseDinerCard
              key={id}
              order={o}
              row={r}
              view={views[i]}
              use={useOf(id)}
              mode={mode[id] ?? 'count'}
              onMode={(m) => setMode((x) => ({ ...x, [id]: m }))}
              overflowChoice={overflowChoice}
              onOverflow={(lineId, v) => setOverflowChoice((x) => ({ ...x, [lineId]: v }))}
              compReason={compReason[id]}
              onComp={() => setAsking(id)}
              guestOnHost={!!guestOnHost[id]}
              guestCreditOn={guestCreditOn}
              planUse={r.person ? pu[r.person.id] : undefined}
              onGuestOnHost={(on) => setGuestOnHost((x) => ({ ...x, [id]: on }))}
              how={howOf(id)}
              onHow={(h) => setHow((x) => ({ ...x, [id]: h }))}
              tablePay={tablePay}
              terminal={terminal[id] ?? 'idle'}
              onTerminal={(st) => setTerminal((x) => ({ ...x, [id]: st }))}
              printed={!!printed[id]}
              onPrint={() => print(id)}
              feeComp={feeComp}
              onFeeComp={() => setAsking('fee')}
              onFeeUndo={() => setFeeComp(null)}
            />
          );
        })}
      </div>

      <footer className={s.footer}>
        {blocked && (
          <div className={s.warn} role="status">
            <AlertCircle size={14} aria-hidden /> The terminal has not reported this payment yet. Send it, then wait for the tap to settle.
          </div>
        )}
        {total > 0 && (
          <TablePayment
            mode={tablePay}
            total={total}
            split={split}
            states={tableTerminal}
            onMode={pickTablePay}
            onSplit={(p) => {
              setSplit(p);
              setTableTerminal({});
            }}
            onState={(i, st) => setTableTerminal((x) => ({ ...x, [i]: st }))}
          />
        )}
        <div className={s.actions}>
          <CloseTotal views={views} total={total} />
          <button className={cx(s.printTable, printed.table && s.printed)} title="Print a receipt for the whole table" onClick={() => print('table')}>
            {printed.table ? <Check size={15} aria-hidden /> : <Printer size={15} aria-hidden />} {printed.table ? 'Printed' : 'Print table'}
          </button>
          <button className={s.close} disabled={blocked} onClick={finish}>
            <Check size={17} aria-hidden /> {blocked ? 'Take card payment on the terminal first' : closeButtonLabel(views, total, closing.length, o.diners.length)}
          </button>
        </div>
      </footer>
    </div>
  );
}
