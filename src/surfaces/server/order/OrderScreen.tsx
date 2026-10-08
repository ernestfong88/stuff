import { useEffect, useRef, useState } from 'react';
import { Trash2, UserPlus } from 'lucide-react';
import { getItem, getTable } from '../../../data';
import { dinerName, findLine, tableName } from '../../../domain/orders';
import { isEmptyCheck } from '../../../domain/seating';
import type { Diner, MealName, Order, QueueType, Resident } from '../../../domain/types';
import { now } from '../../../lib/clock';
import { printerMode } from '../../../domain/config';
import { useConfig } from '../../../store/config';
import { printWarning } from '../../../store/kitchenPrint';
import { liveOverlay } from '../../../store/menuEdits';
import { isoDate } from '../../../domain/pickup';
import { useDiningActions, useDiningOrder } from '../../../store/dining';
import { useSession } from '../../../store/session';
import { useMe } from '../../../shell/session';
import { cx, toast, useConfirm } from '../../../ui';
import { ResidentProfileSheet } from '../features';
import { TakeoverDialog } from '../takeover/TakeoverDialog';
import { CloseScreen } from './close/CloseScreen';
import { AddDiner } from './diners/AddDiner';
import { allergyPerson } from './diners/allergyPerson';
import { DinerCard } from './diners/DinerCard';
import { SpouseSuggest, spouseToAdd } from './diners/SpouseSuggest';
import { afterPick } from './menu/afterPick';
import { menuTabs, orderMenuDate, orderMenuRoom, type MenuTab } from './menu/menuCatalog';
import { MenuPanel } from './menu/MenuPanel';
import { ModifierEditor } from './menu/ModifierEditor';
import { OrderHeader } from './OrderHeader';
import s from './OrderScreen.module.css';
import { HospiceWaiver, SickWaiver } from './queue/FeeWaivers';
import { dayTimes, landing, timeContext } from './queue/orderWhen';
import { PickupTime } from './queue/PickupTime';
import { orderDate, rangesOn } from './queue/pickupWindows';
import { useOrderWhen } from './queue/useOrderWhen';
import { SendBar } from './SendBar';
import { closeCheck, type CloseCheck } from './checkLines';
import { UnsentCloseDialog, type UnsentChoice } from './UnsentCloseDialog';

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
  const dining = useDiningActions();
  const { mode } = useSession();
  const o = useDiningOrder(orderId);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // A check that closes or disappears (another device) sends us back.
  useEffect(() => {
    if (!o) closeRef.current();
  }, [o]);

  // The floor's menu is worked out for a day; one saved on another day (nothing noticed the day turn yet) is worked out again.
  useEffect(() => {
    if (import.meta.env.MODE === 'test' || liveOverlay().date === isoDate(0)) return;
    void import('../../backoffice/menus/data').then((m) => m.freshenLiveMenu());
  }, []);

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
  const dining = useDiningActions();
  const cfg = useConfig();
  const menuRoom = orderMenuRoom(o);
  const menuDate = orderMenuDate(o);
  const tabs = menuTabs(o.meal, menuRoom, menuDate);
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
  // Close & charge with work still out asks first (items never sent, plates still cooking).
  const [closeAsk, setCloseAsk] = useState<CloseCheck | null>(null);
  const me = useMe().initials;
  // A pick up or delivery's day, meal and time move together, and ask about lines the new menu doesn't have.
  const when = useOrderWhen(o);
  const switchMeal = (meal: MealName) => {
    if (!o.queueType) return dining.setOrderMeal(o.id, meal);
    const date = orderDate(o);
    const q = o as Order & { queueType: QueueType };
    const st = dining.getState();
    const l = rangesOn(o.queueType)
      ? landing(o, dayTimes(q, date, timeContext(o, { orders: st.orders, history: st.history, assoc: st.assocOrders })), { meal })
      : { meal, readyAt: o.readyAt ?? null };
    when.change({ date, ...l });
  };

  // Switching the check's meal (or a pick up's day) starts its menu on the first tab.
  const meal = useRef(o.meal + ' ' + menuDate);
  useEffect(() => {
    if (meal.current === o.meal + ' ' + menuDate) return;
    meal.current = o.meal + ' ' + menuDate;
    setTab(menuTabs(o.meal, menuRoom, menuDate)[0] ?? 'Entrees');
  }, [o.meal, menuRoom, menuDate]);

  // Keep a diner selected when the selected one leaves.
  useEffect(() => {
    if (!o.diners.some((d) => d.id === selected)) setSelected(o.diners[0]?.id ?? null);
  }, [o.diners, selected]);

  const sentTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(sentTimer.current), []);

  /**
   * A table tapped by mistake: leaving my check with nobody on it removes it
   * (like an empty pick up order), so it never sits on the floor or blocks the
   * shift review. Someone else's empty check is theirs to leave or void.
   */
  const leave = () => {
    const drop = isEmptyCheck(o) && o.server === me;
    onClose();
    if (drop) {
      dining.closeOrder(o.id);
      toast(`Nobody was added, so the empty check at ${tableName(o)} was removed.`);
    }
  };
  const voidEmpty = () => {
    onClose();
    dining.closeOrder(o.id);
    toast(`Voided the empty check at ${tableName(o)}.`);
  };

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
    // Printer mode: the store prints whatever the send fires (see store/kitchenPrint).
    const printed = dining.sendOrder(o.id);
    if (printed) {
      setPrintNote(printed.summary);
      const warn = printWarning(printed);
      if (warn) toast(warn, { tone: 'danger' });
    } else if (printerMode(cfg)) setPrintNote(undefined);
    setJustSent(true);
    sentTimer.current = setTimeout(() => {
      setJustSent(false);
      onClose();
    }, SENT_FLASH_MS);
  };

  const startClose = () => {
    const c = closeCheck(o, cfg);
    if (c.unsentItems > 0 || c.inKitchen > 0) setCloseAsk(c);
    else setClosing({ dinerIds: null });
  };
  const chooseClose = (choice: UnsentChoice) => {
    const c = closeAsk;
    setCloseAsk(null);
    if (!c) return;
    if (choice === 'send') {
      // Release what is held (a side goes with its plate), then send it all and keep the check open.
      const held = new Set(c.unsent.filter((u) => u.line.hold).map((u) => u.line.id));
      for (const u of c.unsent) if (u.line.hold && !(u.line.parentId && held.has(u.line.parentId))) dining.toggleHold(o.id, u.dinerId, u.line.id);
      send();
      return;
    }
    if (choice === 'remove') for (const u of c.unsent) dining.removeItem(o.id, u.dinerId, u.line.id);
    setClosing({ dinerIds: null });
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
      <OrderHeader order={o} onBack={leave} onMeal={switchMeal} />
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
          {isEmptyCheck(o) && (
            <button className={s.voidEmpty} onClick={voidEmpty}>
              <Trash2 size={15} aria-hidden /> Void empty check
            </button>
          )}
          {o.queueType && <PickupTime order={o as Order & { queueType: QueueType }} onWhen={when.change} />}
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
      <SendBar order={o} justSent={justSent} printNote={printNote} onSend={send} onClose={startClose} />
      {closeAsk && <UnsentCloseDialog check={closeAsk} onChoose={chooseClose} onCancel={() => setCloseAsk(null)} />}
      <ResidentProfileSheet residentId={profile} onClose={() => setProfile(null)} />
      {confirmDialog}
      {when.dialog}
      <TakeoverDialog />
    </div>
  );
}
