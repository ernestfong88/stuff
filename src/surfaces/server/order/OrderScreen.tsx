import { useEffect, useRef, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { getItem, getTable } from '../../../data';
import { dinerName, findLine } from '../../../domain/orders';
import type { Diner, Order, QueueType, Resident } from '../../../domain/types';
import { now } from '../../../lib/clock';
import { printerMode } from '../../../domain/config';
import { printJobs, printSummary } from '../../../domain/printing';
import { useConfig } from '../../../store/config';
import { printItemsFor } from '../../../store/printing';
import { kitchenPrinters, venueSettingsStore } from '../../../store/venueSettings';
import { useDining } from '../../../store/dining';
import { useSession } from '../../../store/session';
import { cx, toast, useConfirm } from '../../../ui';
import { ResidentProfileSheet } from '../features';
import { TakeoverDialog } from '../takeover/TakeoverDialog';
import { CloseScreen } from './close/CloseScreen';
import { AddDiner } from './diners/AddDiner';
import { allergyPerson } from './diners/allergyPerson';
import { DinerCard } from './diners/DinerCard';
import { SpouseSuggest, spouseToAdd } from './diners/SpouseSuggest';
import { afterPick } from './menu/afterPick';
import { menuTabs, type MenuTab } from './menu/menuCatalog';
import { MenuPanel } from './menu/MenuPanel';
import { ModifierEditor } from './menu/ModifierEditor';
import { OrderHeader } from './OrderHeader';
import s from './OrderScreen.module.css';
import { HospiceWaiver, SickWaiver } from './queue/FeeWaivers';
import { PickupTime } from './queue/PickupTime';
import { SendBar } from './SendBar';

export interface OrderScreenProps {
  /** The open order (dine-in check or pick up / delivery order). */
  orderId: string;
  /** Back to wherever the check was opened from. */
  onClose: () => void;
  /** Open on this menu tab, e.g. "Desserts" from a table card's Dessert button. */
  initialCategory?: string;
}

/** How long the "Sent" confirmation shows before going back. */
const SENT_FLASH_MS = 900;

/**
 * Take the order, fire courses, and close the check with payment.
 *
 * The screen takes over the whole device (it draws its own header with the
 * text size and mode controls), so host it on its own rather than inside a
 * TabletShell. It works for dine-in checks and for pick up / delivery
 * orders (`order.queueType`).
 */
export function OrderScreen({ orderId, onClose, initialCategory }: OrderScreenProps) {
  const dining = useDining();
  const { mode } = useSession();
  const o = dining.orders.find((x) => x.id === orderId);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // A check that closes or disappears (another device) sends us back.
  useEffect(() => {
    if (!o) closeRef.current();
  }, [o]);

  // A host seated the table: the first time the server opens it counts as the greeting.
  const greeted = useRef(false);
  useEffect(() => {
    if (greeted.current || !o) return;
    greeted.current = true;
    if (o.hostSeated && !o.greetedAt && mode === 'server') dining.patchOrder(o.id, { greetedAt: now() });
  }, [o, dining, mode]);

  if (!o) return null;
  return <CheckView key={o.id} order={o} onClose={onClose} initialCategory={initialCategory} />;
}

function CheckView({ order: o, onClose, initialCategory }: { order: Order; onClose: () => void; initialCategory?: string }) {
  const dining = useDining();
  const cfg = useConfig();
  const tabs = menuTabs(o.meal);
  const startTab = (): MenuTab =>
    initialCategory && tabs.includes(initialCategory as MenuTab) ? (initialCategory as MenuTab) : (tabs[0] ?? 'Entrees');
  const [selected, setSelected] = useState<string | null>(o.diners[0]?.id ?? null);
  const [adding, setAdding] = useState(o.diners.length === 0);
  const [guestHost, setGuestHost] = useState<Resident | null>(null);
  const [editing, setEditing] = useState<{ dinerId: string; lineId: string } | null>(null);
  const [closing, setClosing] = useState<{ dinerIds: string[] | null } | null>(null);
  const [justSent, setJustSent] = useState(false);
  // Printer mode: which printers this send printed at, for the confirmation.
  const [printNote, setPrintNote] = useState<string | undefined>();
  const [tab, setTab] = useState<MenuTab>(startTab);
  const [sideWait, setSideWait] = useState<string | null>(null);
  const [profile, setProfile] = useState<string | null>(null);
  const [ask, confirmDialog] = useConfirm();

  // Switching the check's meal starts its menu on the first tab.
  const meal = useRef(o.meal);
  useEffect(() => {
    if (meal.current === o.meal) return;
    meal.current = o.meal;
    setTab(menuTabs(o.meal)[0] ?? 'Entrees');
  }, [o.meal]);

  // Keep a diner selected when the selected one leaves.
  useEffect(() => {
    if (!o.diners.some((d) => d.id === selected)) setSelected(o.diners[0]?.id ?? null);
  }, [o.diners, selected]);

  const sentTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(sentTimer.current), []);

  const diner = o.diners.find((d) => d.id === selected) ?? null;
  const table = o.tableId ? getTable(o.tableId) : undefined;
  const spouse = spouseToAdd(o);

  // Removing someone with items on the check takes the items too, so ask first.
  const removeDiner = async (d: Diner) => {
    const lines = d.items.filter((l) => !l.cancelled && !l.parentId).length;
    if (lines > 0) {
      const sent = d.items.some((l) => l.sent && !l.cancelled);
      const ok = await ask({
        title: `Remove ${dinerName(d)} from the check?`,
        message:
          `Their ${lines === 1 ? 'item comes' : `${lines} items come`} off the check too.` +
          (sent ? ' Anything already sent to the kitchen is dropped from the tickets.' : ''),
        confirmLabel: 'Remove',
        tone: 'danger',
      });
      if (!ok) return;
    }
    dining.removeDiner(o.id, d.id);
  };

  const select = (id: string, nextTab?: MenuTab) => {
    setSelected(id);
    if (nextTab) setTab(nextTab);
  };
  const picked = (dinerId: string, itemId: string) => {
    const next = afterPick(o, dinerId, itemId, sideWait, tabs, cfg);
    setSideWait(next.sideWait);
    if (next.diner) select(next.diner, next.tab);
    else if (next.tab) setTab(next.tab);
  };
  const send = () => {
    if (printerMode(cfg)) {
      const items = printItemsFor(
        o.diners
          .flatMap((d) => d.items)
          .filter((l) => !l.sent && !l.hold)
          .map((l) => l.itemId),
      );
      const jobs = printJobs(items, kitchenPrinters(venueSettingsStore.get(), o.room).filter((p) => p.active));
      setPrintNote(printSummary(jobs));
      const down = jobs.filter((j) => !j.printer.reachable).map((j) => j.printer.name);
      if (down.length) toast(`${down.join(' and ')} can't be reached. Tell the kitchen what's on the ticket.`, { tone: 'danger' });
    }
    dining.sendOrder(o.id);
    setJustSent(true);
    sentTimer.current = setTimeout(() => {
      setJustSent(false);
      onClose();
    }, SENT_FLASH_MS);
  };

  if (closing) {
    return (
      <div className={s.screen}>
        <CloseScreen order={o} dinerIds={closing.dinerIds} onBack={() => setClosing(null)} onDone={onClose} />
        <TakeoverDialog />
      </div>
    );
  }

  const edit = editing ? findLine(o, editing.lineId) : null;
  const editItem = edit ? getItem(edit.line.itemId) : undefined;

  return (
    <div className={s.screen}>
      <OrderHeader order={o} onBack={onClose} />
      <div className={s.body}>
        <section className={cx(s.diners, 'scroll')} aria-label="Diners">
          {o.diners.map((d) => (
            <DinerCard
              key={d.id}
              order={o}
              diner={d}
              selected={d.id === selected}
              round={table?.shape === 'round'}
              usualsOn={(cfg.flow as Record<string, boolean | undefined>).usuals !== false}
              onSelect={() => select(d.id)}
              onAddGuest={(host) => {
                setGuestHost(host);
                setAdding(true);
              }}
              onRemove={() => removeDiner(d)}
              onEditLine={(line) => setEditing({ dinerId: d.id, lineId: line.id })}
              onAddUsual={(u) => {
                select(d.id);
                dining.addItem(o.id, d.id, u.item.id, u.mods, u.note);
                picked(d.id, u.item.id);
              }}
              onCloseDiner={(onPlan) => (onPlan ? dining.closeDiner(o.id, d.id, 'plan') : setClosing({ dinerIds: [d.id] }))}
            />
          ))}
          {spouse && (
            <SpouseSuggest
              host={spouse.host}
              spouse={spouse.spouse}
              onAdd={() => {
                const id = dining.addDiner(o.id, 'resident', spouse.spouse.id, false);
                if (id) setSelected(id);
              }}
            />
          )}
          {adding ? (
            <AddDiner
              key={guestHost?.id ?? 'any'}
              order={o}
              guestHost={guestHost}
              onClose={() => {
                setAdding(false);
                setGuestHost(null);
              }}
              onAdded={(id) => {
                setSelected(id);
                setAdding(false);
                setGuestHost(null);
              }}
            />
          ) : (
            <button className={s.addDiner} onClick={() => setAdding(true)}>
              <UserPlus size={16} aria-hidden /> Add diner to this check
            </button>
          )}
          {o.queueType && <PickupTime order={o as Order & { queueType: QueueType }} />}
          {o.queueType === 'delivery' && <HospiceWaiver order={o} />}
          {o.queueType === 'delivery' && <SickWaiver order={o} />}
        </section>
        <section className={s.menu} aria-label="Menu">
          <div className={cx(s.menuScroll, 'scroll')}>
            {diner ? (
              <MenuPanel
                key={diner.id}
                order={o}
                diner={diner}
                tab={tab}
                onTab={setTab}
                sideWait={sideWait}
                onPicked={(itemId) => picked(diner.id, itemId)}
                onProfile={setProfile}
              />
            ) : (
              <p className={s.noDiner}>Add a diner, then pick their items here.</p>
            )}
          </div>
          {edit && editItem && (
            <ModifierEditor
              key={edit.line.id}
              item={editItem}
              diner={edit.diner}
              person={allergyPerson(edit.diner)}
              initialMods={edit.line.mods}
              initialNote={edit.line.note}
              confirmLabel="Save changes"
              onAuto={(mods, note) => dining.updateItem(o.id, edit.diner.id, edit.line.id, mods, note)}
              onCancel={() => setEditing(null)}
              onConfirm={(mods, note) => {
                dining.updateItem(o.id, edit.diner.id, edit.line.id, mods, note);
                setEditing(null);
              }}
            />
          )}
        </section>
      </div>
      <SendBar order={o} justSent={justSent} printNote={printNote} onSend={send} onClose={() => setClosing({ dinerIds: null })} />
      <ResidentProfileSheet residentId={profile} onClose={() => setProfile(null)} />
      {confirmDialog}
      <TakeoverDialog />
    </div>
  );
}
