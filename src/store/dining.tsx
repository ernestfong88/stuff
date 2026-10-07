/**
 * The shared dining store: open checks, closed checks and associate meals,
 * plus every action the surfaces (server tablet, host, kitchen, expo, bar,
 * PU & Delivery, manager, Back Office) take on them.
 *
 * State transitions are the pure functions in src/domain/diningActions.ts.
 * This provider adds what they cannot do on their own:
 *   - ids for new checks, seats and lines;
 *   - the check timeline (each logged action writes onto order.log);
 *   - asking before a server changes someone else's check (takeover);
 *   - cross-tab sync, persistence and the 5 second course pacing timer,
 *     which runs in one tab only (see diningEngine.ts).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { getItem, modDefaults } from '../data';
import {
  appendLogEvent,
  dinerLabel,
  kitchenStateText,
  logAuthor,
  logEvent,
  needsTakeover,
  pacingText,
  seatedText,
  takeOverOrder,
  type LoggedAction,
  type ReadyStamp,
} from '../domain/activityLog';
import { activeRunUndo, runUndoSnapshot, type RunUndo } from '../domain/courses';
import { printerMode } from '../domain/config';
import * as A from '../domain/diningActions';
import type { DiningState } from '../domain/diningState';
import { chosenMods, defaultSides, itemLabel, modsText } from '../domain/menu';
import { findLine, learnedFavorites, lineLabel, plateLines, sendText, type LearnedFavorite } from '../domain/orders';
import { pickupLeadMinutes } from '../domain/pickup';
import { serverName } from '../domain/servers';
import type {
  AssocMeal,
  Diner,
  FireMode,
  KitchenState,
  MealName,
  ModSelection,
  Order,
  OrderComp,
  QueueType,
} from '../domain/types';
import { now } from '../lib/clock';
import { uid } from '../lib/id';
import { resetPersistedStores, useShared } from '../lib/sharedStore';
import { configStore, getConfig, updateConfig } from './config';
import { resetProduction } from './production';
import { claimPacingLeadership, createDiningEngine, releasePacingLeadership, type DiningEngine } from './diningEngine';
import { residentPrefsStore, updateResidentPref, type ResidentPrefs } from './residentPrefs';
import { sessionStore } from './session';

/** How often the course pacing timer looks for held courses that are due. */
export const PACING_INTERVAL_MS = 5000;

export interface RecentBump {
  orderId: string;
  at: number;
  level: 'ready' | 'cleared';
}

export interface PendingTakeover {
  orderId: string;
  /** First name of the server who has the check now. */
  from: string;
}

type Setter<T> = (next: T | ((prev: T) => T)) => void;

export interface DiningApi {
  // ── State ──
  orders: Order[];
  history: Order[];
  assocOrders: AssocMeal[];
  /** The last 5 checks expo bumped on this device, newest first. */
  recentBumps: RecentBump[];
  expoActive: boolean;
  kitchenMode: string;
  resPrefs: ResidentPrefs;
  /** A change waiting for the server to confirm taking over someone else's check. */
  pendingTakeover: PendingTakeover | null;

  // ── Raw setters (bypass logging; prefer the actions) ──
  setOrders: Setter<Order[]>;
  setHistory: Setter<Order[]>;
  setAssocOrders: Setter<AssocMeal[]>;

  // ── Selectors ──
  getTableOrder(tableId: string): Order | undefined;
  getOrderById(orderId: string): Order | undefined;
  learnedFavorites(residentId: string, meal?: MealName): LearnedFavorite[];
  usageFor(itemId: string): Record<string, number>;
  runUndoFor(orderId: string): RunUndo | null;

  // ── Opening checks ──
  openOrder(tableId: string, room: string, meal?: MealName, server?: string): string;
  newCheck(tableId: string, room: string, meal?: MealName, server?: string): string;
  openQueueOrder(type: QueueType, room?: string, meal?: MealName): string;
  addOrder(order: Order): void;
  setOrderMeal(orderId: string, meal: MealName): void;
  setDelivery(orderId: string, deliveryFeeId: string): void;
  patchOrder(orderId: string, patch: Partial<Order>): void;
  setCorkage(orderId: string, bottles: number): void;
  setAskedFor(orderId: string, at?: number | null): void;

  // ── Diners ──
  addDiner(orderId: string, kind: Diner['kind'], refId: string, isGuest?: boolean, extra?: Partial<Diner>): string | undefined;
  removeDiner(orderId: string, dinerId: string): void;
  editSeat(orderId: string, dinerId: string, seat: number): void;
  setFeedback(orderId: string, dinerId: string, feedback: unknown): void;

  // ── Lines ──
  addItem(orderId: string, dinerId: string, itemId: string, mods: ModSelection, note?: string, parentId?: string): string | undefined;
  removeItem(orderId: string, dinerId: string, lineId: string): void;
  updateItem(orderId: string, dinerId: string, lineId: string, mods: ModSelection, note: string): void;
  toggleHold(orderId: string, dinerId: string, lineId: string): void;
  setLineCourse(orderId: string, dinerId: string, lineId: string, course: number): void;
  setToGo(orderId: string, dinerId: string, lineId: string): void;
  cancelLine(orderId: string, dinerId: string, lineId: string): void;
  remakeLine(orderId: string, dinerId: string, lineId: string): void;
  dismissReminder(orderId: string, lineId: string, reminder: string): void;

  // ── Sending and pacing ──
  sendOrder(orderId: string): void;
  sendCourse(orderId: string, categories: string[]): void;
  fireCourseNow(orderId: string, course: number): void;
  setOrderPacing(orderId: string, mode: FireMode, timerMin?: number): void;

  // ── Kitchen, expo and the table ──
  setItemKitchenState(orderId: string, lineId: string, state: KitchenState): void;
  markCourseReady(orderId: string, course: number, lineIds?: string[]): void;
  markOrderReady(orderId: string): void;
  clearCourse(orderId: string, course: number): void;
  clearOrder(orderId: string): void;
  runCourse(orderId: string, course: number): void;
  markServed(orderId: string, course: number): void;
  undoRunCourse(orderId: string, course: number, undo: RunUndo): void;
  recallToCooking(orderId: string): void;
  recallCleared(orderId: string): void;
  serveDrinks(orderId: string, lineIds?: string[]): void;
  markBarUp(orderId: string): void;
  checkIn(orderId: string, course: number): void;
  noDessert(orderId: string): void;

  // ── Pick up and delivery ──
  setOrderSchedule(orderId: string, readyAt: string): void;
  notifyOrder(orderId: string): void;
  sendPickupReminder(orderId: string): void;
  setOrderComp(orderId: string, comp: OrderComp | null): void;
  markPickedUp(orderId: string): void;
  markDelivered(orderId: string): void;

  // ── Closing ──
  closeOrder(orderId: string, drops?: Record<string, string | null | undefined>): void;
  closeDiner(orderId: string, dinerId: string, drop?: string): void;
  reopenOrder(orderId: string): void;

  // ── Device, preferences and takeover ──
  recordModUsage(itemId: string, groupId: string): void;
  updateResidentPref(residentId: string, text: string): void;
  setExpoActive(on: boolean): void;
  setKitchenMode(mode: string): void;
  confirmTakeover(): void;
  cancelTakeover(): void;

  // ── Demo ──
  /** Empty the floor and history. */
  clearAll(): void;
  /** Restore every seed: checks, history, associate meals, notices, 86 list, notes, preferences and settings. */
  resetDemo(): void;
}

const DiningContext = createContext<DiningApi | null>(null);

/** The dining store. Must be used under DiningProvider. */
export function useDining(): DiningApi {
  const v = useContext(DiningContext);
  if (!v) throw new Error('useDining must be used inside <DiningProvider>');
  return v;
}

const pushBump = (list: RecentBump[], orderId: string, level: RecentBump['level']): RecentBump[] =>
  [{ orderId, at: now(), level }, ...list.filter((b) => b.orderId !== orderId)].slice(0, 5);

export function DiningProvider({ children, engine: given }: { children: ReactNode; engine?: DiningEngine }) {
  const [engine] = useState(() => given ?? createDiningEngine());
  const state = useSyncExternalStore(engine.subscribe, engine.get, engine.get);
  const resPrefs = useShared(residentPrefsStore);

  const [recentBumps, setRecentBumps] = useState<RecentBump[]>([]);
  const [modUsage, setModUsage] = useState<Record<string, Record<string, number>>>({});
  const [expoActive, setExpoActive] = useState(true);
  // How orders reach the kitchen, from the setting (KDS Settings, Service Flow).
  const kitchenMode = printerMode(useShared(configStore)) ? 'printers' : 'kds_expo';
  const [pendingTakeover, setPendingTakeover] = useState<(PendingTakeover & { go: () => void }) | null>(null);
  const runUndos = useRef(new Map<string, RunUndo>());

  useEffect(() => engine.connect(), [engine]);

  // Course pacing: fire held courses when they are due, in one tab only.
  useEffect(() => {
    const timer = setInterval(() => {
      if (!claimPacingLeadership(engine.tabId)) return;
      engine.update((s) => {
        const orders = A.pacingTick(s.orders, getConfig());
        return orders === s.orders ? s : { ...s, orders };
      });
    }, PACING_INTERVAL_MS);
    return () => {
      clearInterval(timer);
      releasePacingLeadership(engine.tabId);
    };
  }, [engine]);

  const actions = useMemo(() => {
    const ctx = (): A.ActionContext => {
      const s = engine.get();
      const cfg = getConfig();
      return { cfg, pickupLead: pickupLeadMinutes([...s.orders, ...s.history], cfg) };
    };
    const findAny = (orderId: string) => {
      const s = engine.get();
      return s.orders.find((o) => o.id === orderId) ?? s.history.find((o) => o.id === orderId);
    };
    const label = (itemId: string) => itemLabel(itemId, getConfig());

    interface LogOptions {
      course?: number;
      stamp?: ReadyStamp;
      /** Device-local follow-up, run with the change (also after a confirmed takeover). */
      after?: () => void;
    }

    /**
     * Run a logged action: write the timeline entry (worded against the
     * check as it was before the change), then apply the change, as one
     * update. A change to another server's open check waits for
     * confirmTakeover instead.
     */
    const logged = (
      action: LoggedAction,
      orderId: string,
      describe: (o: Order) => string,
      reduce: (s: DiningState) => DiningState,
      opts: LogOptions = {},
    ): boolean => {
      const o = findAny(orderId);
      const { mode, me } = sessionStore.get();
      const run = (target: Order | undefined) => {
        engine.update((s) => {
          if (!target) return reduce(s);
          let what: string;
          try {
            what = describe(target);
          } catch {
            what = action;
          }
          return reduce(appendLogEvent(s, target.id, logEvent(action, logAuthor(mode, target), what, opts.course), opts.stamp));
        });
        opts.after?.();
      };
      if (o && me && needsTakeover(action, o, me, mode)) {
        setPendingTakeover({
          orderId: o.id,
          from: serverName(o.server),
          go: () => {
            engine.update((s) => ({ ...s, orders: takeOverOrder(s.orders, o.id, me) }));
            run({ ...o, server: me });
          },
        });
        return false;
      }
      run(o);
      return true;
    };

    const opened = (id: string, server: string | undefined) => (s: DiningState) =>
      appendLogEvent(s, id, logEvent('openOrder', logAuthor(sessionStore.get().mode, { server: server || 'AA' }), 'Opened the check'));

    const lineText = (lineId: string) => (o: Order) => lineLabel(o, lineId, getConfig());

    const setOrders: Setter<Order[]> = (next) =>
      engine.update((s) => ({ ...s, orders: typeof next === 'function' ? next(s.orders) : next }));
    const setHistory: Setter<Order[]> = (next) =>
      engine.update((s) => ({ ...s, history: typeof next === 'function' ? next(s.history) : next }));
    const setAssocOrders: Setter<AssocMeal[]> = (next) =>
      engine.update((s) => ({ ...s, assocOrders: typeof next === 'function' ? next(s.assocOrders) : next }));

    const api: Omit<
      DiningApi,
      | 'orders'
      | 'history'
      | 'assocOrders'
      | 'recentBumps'
      | 'expoActive'
      | 'kitchenMode'
      | 'resPrefs'
      | 'pendingTakeover'
      | 'usageFor'
      | 'confirmTakeover'
    > = {
      setOrders,
      setHistory,
      setAssocOrders,

      getTableOrder: (tableId) => engine.get().orders.find((o) => o.tableId === tableId),
      getOrderById: (orderId) => engine.get().orders.find((o) => o.id === orderId),
      learnedFavorites: (residentId, meal) => learnedFavorites(engine.get().history, residentId, meal),
      runUndoFor: (orderId) => {
        const o = engine.get().orders.find((x) => x.id === orderId);
        const u = runUndos.current.get(orderId);
        const live = o ? activeRunUndo(o, u) : null;
        if (!live) runUndos.current.delete(orderId);
        return live;
      },

      openOrder(tableId, room, meal, server) {
        const existing = A.findTableCheck(engine.get(), tableId, server);
        if (existing) return existing.id;
        const id = uid('o');
        engine.update((s) => opened(id, server)(A.newCheck(s, id, { tableId, room, meal, server })));
        return id;
      },
      newCheck(tableId, room, meal, server) {
        const id = uid('o');
        engine.update((s) => opened(id, server)(A.newCheck(s, id, { tableId, room, meal, server })));
        return id;
      },
      openQueueOrder(type, room, meal) {
        const id = uid('q');
        engine.update((s) => A.openQueueOrder(s, id, type, room, meal));
        return id;
      },
      addOrder: (order) => engine.update((s) => A.addOrder(s, order)),
      setOrderMeal: (orderId, meal) =>
        void logged('setOrderMeal', orderId, () => 'Switched the check to ' + meal, (s) => A.setOrderMeal(s, orderId, meal)),
      setDelivery: (orderId, feeId) =>
        void logged('setDelivery', orderId, () => 'Delivery fee changed', (s) => A.setDelivery(s, orderId, feeId)),
      patchOrder: (orderId, patch) => engine.update((s) => A.patchOrder(s, orderId, patch)),
      setCorkage: (orderId, bottles) =>
        void logged(
          'setCorkage',
          orderId,
          () => (bottles > 0 ? `Corkage: ${bottles}${bottles === 1 ? ' bottle' : ' bottles'}` : 'Corkage removed'),
          (s) => A.setCorkage(s, orderId, bottles),
        ),
      setAskedFor: (orderId, at) => engine.update((s) => A.setAskedFor(s, orderId, at)),

      addDiner(orderId, kind, refId, isGuest, extra) {
        const id = uid('s');
        return logged(
          'addDiner',
          orderId,
          () => seatedText(kind, refId, !!isGuest, extra),
          (s) => A.addDiner(s, orderId, id, kind, refId, isGuest, extra),
        )
          ? id
          : undefined;
      },
      removeDiner: (orderId, dinerId) =>
        void logged('removeDiner', orderId, (o) => 'Removed ' + dinerLabel(o, dinerId), (s) => A.removeDiner(s, orderId, dinerId)),
      editSeat: (orderId, dinerId, seat) =>
        void logged(
          'editSeat',
          orderId,
          (o) => `Moved ${dinerLabel(o, dinerId)} to seat ${seat}`,
          (s) => A.editSeat(s, orderId, dinerId, seat),
        ),
      setFeedback: (orderId, dinerId, feedback) =>
        void logged(
          'setFeedback',
          orderId,
          (o) => 'Feedback from ' + dinerLabel(o, dinerId),
          (s) => A.setFeedback(s, orderId, dinerId, feedback),
        ),

      addItem(orderId, dinerId, itemId, mods, note, parentId) {
        const id = uid('li');
        const sideIds = defaultSides(itemId).map(() => uid('sd'));
        return logged(
          'addItem',
          orderId,
          (o) => `Added ${label(itemId)} for ${dinerLabel(o, dinerId)}`,
          (s) => A.addItem(s, orderId, dinerId, { id, itemId, mods, note, parentId, sideIds }),
        )
          ? id
          : undefined;
      },
      removeItem: (orderId, dinerId, lineId) =>
        void logged('removeItem', orderId, (o) => 'Removed ' + lineText(lineId)(o), (s) => A.removeItem(s, orderId, dinerId, lineId)),
      updateItem: (orderId, dinerId, lineId, mods, note) =>
        void logged(
          'updateItem',
          orderId,
          (o) => {
            const f = findLine(o, lineId);
            const detail = f ? modsText(chosenMods(mods, getItem(f.line.itemId), getConfig()), note) : '';
            return 'Changed ' + lineText(lineId)(o) + (detail ? ': ' + detail : '');
          },
          (s) => A.updateItem(s, orderId, dinerId, lineId, mods, note),
        ),
      toggleHold: (orderId, dinerId, lineId) =>
        void logged(
          'toggleHold',
          orderId,
          (o) => (findLine(o, lineId)?.line.hold ? 'Released ' : 'Held ') + lineText(lineId)(o),
          (s) => A.toggleHold(s, orderId, dinerId, lineId),
        ),
      setLineCourse: (orderId, dinerId, lineId, course) =>
        void logged(
          'setLineCourse',
          orderId,
          (o) => `${lineText(lineId)(o)} moved to C${course}`,
          (s) => A.setLineCourse(s, orderId, dinerId, lineId, course),
        ),
      setToGo: (orderId, dinerId, lineId) =>
        void logged('setToGo', orderId, (o) => lineText(lineId)(o) + ' to go', (s) => A.setToGo(s, orderId, dinerId, lineId)),
      cancelLine: (orderId, dinerId, lineId) =>
        void logged('cancelLine', orderId, (o) => 'Cancelled ' + lineText(lineId)(o), (s) => A.cancelLine(s, orderId, dinerId, lineId)),
      remakeLine: (orderId, dinerId, lineId) => {
        const id = uid('rm');
        logged('remakeLine', orderId, (o) => 'Remake: ' + lineText(lineId)(o), (s) =>
          A.remakeLine(s, orderId, dinerId, lineId, id, ctx()),
        );
      },
      dismissReminder: (orderId, lineId, reminder) => engine.update((s) => A.dismissReminder(s, orderId, lineId, reminder)),

      sendOrder: (orderId) =>
        void logged('sendOrder', orderId, (o) => sendText(plateLines(o, false)), (s) => A.sendOrder(s, orderId, ctx())),
      sendCourse: (orderId, categories) =>
        void logged('sendCourse', orderId, () => 'Sent ' + categories.join(', '), (s) => A.sendCourse(s, orderId, categories)),
      fireCourseNow: (orderId, course) =>
        void logged('fireCourseNow', orderId, () => 'Fired C' + course, (s) => A.fireCourseNow(s, orderId, course, ctx()), { course }),
      setOrderPacing: (orderId, mode, timerMin) =>
        void logged('setOrderPacing', orderId, () => pacingText(mode, timerMin), (s) => A.setOrderPacing(s, orderId, mode, timerMin)),

      setItemKitchenState: (orderId, lineId, ks) =>
        void logged(
          'setItemKitchenState',
          orderId,
          (o) => kitchenStateText(o, lineId, ks, label),
          (s) => A.setItemKitchenState(s, orderId, lineId, ks),
          { stamp: ks === 'ready' ? { kind: 'line', lineId } : undefined },
        ),
      markCourseReady: (orderId, course, lineIds) =>
        void logged('markCourseReady', orderId, () => `C${course} up at the pass`, (s) => A.markCourseReady(s, orderId, course, lineIds), {
          course,
          stamp: { kind: 'course', course },
          after: () => setRecentBumps((b) => pushBump(b, orderId, 'ready')),
        }),
      markOrderReady: (orderId) =>
        void logged('markOrderReady', orderId, () => 'Every plate up at the pass', (s) => A.markOrderReady(s, orderId), {
          stamp: { kind: 'order' },
          after: () => setRecentBumps((b) => pushBump(b, orderId, 'ready')),
        }),
      clearCourse: (orderId, course) =>
        void logged('clearCourse', orderId, () => 'Ran C' + course, (s) => A.clearCourse(s, orderId, course), { course }),
      clearOrder: (orderId) =>
        void logged('clearOrder', orderId, () => 'Ran every plate', (s) => A.clearOrder(s, orderId), {
          after: () => setRecentBumps((b) => pushBump(b, orderId, 'cleared')),
        }),
      runCourse: (orderId, course) =>
        void logged('runCourse', orderId, () => 'Ran C' + course, (s) => A.runCourse(s, orderId, course), { course }),
      markServed(orderId, course) {
        const o = engine.get().orders.find((x) => x.id === orderId);
        if (!o) return;
        const undo = runUndoSnapshot(o, course);
        logged('runCourse', orderId, () => 'Ran C' + course, (s) => A.runCourse(s, orderId, course), {
          course,
          after: () => runUndos.current.set(orderId, undo),
        });
      },
      undoRunCourse(orderId, course, undo) {
        runUndos.current.delete(orderId);
        logged('undoRunCourse', orderId, () => `Undid C${course} served`, (s) => A.undoRunCourse(s, orderId, undo), { course });
      },
      recallToCooking: (orderId) =>
        void logged('recallToCooking', orderId, () => 'Recalled to cooking', (s) => A.recallToCooking(s, orderId), {
          stamp: { kind: 'recall' },
        }),
      recallCleared: (orderId) =>
        void logged('recallCleared', orderId, () => 'Recalled from the table', (s) => A.recallCleared(s, orderId), {
          after: () => setRecentBumps((b) => b.filter((x) => x.orderId !== orderId)),
        }),
      serveDrinks: (orderId, lineIds) =>
        void logged('serveDrinks', orderId, () => 'Drinks served', (s) => A.serveDrinks(s, orderId, lineIds)),
      markBarUp: (orderId) => void logged('markBarUp', orderId, () => 'Drinks up at the bar', (s) => A.markBarUp(s, orderId)),
      checkIn: (orderId, course) =>
        void logged('checkIn', orderId, () => 'Checked in after C' + course, (s) => A.checkIn(s, orderId, course), { course }),
      noDessert: (orderId) => void logged('noDessert', orderId, () => 'No dessert', (s) => A.noDessert(s, orderId)),

      setOrderSchedule: (orderId, readyAt) =>
        void logged('setOrderSchedule', orderId, () => 'Ready time set to ' + readyAt, (s) => A.setOrderSchedule(s, orderId, readyAt)),
      notifyOrder: (orderId) => void logged('notifyOrder', orderId, () => 'Resident notified', (s) => A.notifyOrder(s, orderId)),
      sendPickupReminder: (orderId) =>
        void logged('sendPickupReminder', orderId, () => 'Pickup reminder sent', (s) => A.sendPickupReminder(s, orderId)),
      setOrderComp: (orderId, comp) =>
        void logged(
          'setOrderComp',
          orderId,
          () => (comp ? 'Comped the check' + (comp.reason ? ': ' + comp.reason : '') : 'Comp removed'),
          (s) => A.setOrderComp(s, orderId, comp),
        ),
      markPickedUp: (orderId) => void logged('markPickedUp', orderId, () => 'Picked up', (s) => A.markPickedUp(s, orderId)),
      markDelivered: (orderId) => void logged('markDelivered', orderId, () => 'Delivered', (s) => A.markDelivered(s, orderId)),

      closeOrder: (orderId, drops) =>
        void logged('closeOrder', orderId, () => 'Closed the check', (s) => A.closeOrder(s, orderId, drops)),
      closeDiner: (orderId, dinerId, drop) =>
        void logged(
          'closeDiner',
          orderId,
          (o) => `Closed ${dinerLabel(o, dinerId)}'s part of the check`,
          (s) => A.closeDiner(s, orderId, dinerId, drop),
        ),
      reopenOrder: (orderId) => void logged('reopenOrder', orderId, () => 'Reopened the check', (s) => A.reopenOrder(s, orderId)),

      recordModUsage: (itemId, groupId) =>
        setModUsage((u) => ({ ...u, [itemId]: { ...u[itemId], [groupId]: (u[itemId]?.[groupId] ?? 0) + 1 } })),
      updateResidentPref,
      setExpoActive,
      setKitchenMode: (mode: string) => updateConfig({ kitchenMode: mode === 'printers' ? 'printers' : 'kds' }),
      cancelTakeover: () => setPendingTakeover(null),

      clearAll: () => engine.update((s) => ({ ...s, orders: [], history: [] })),
      resetDemo() {
        engine.reset();
        // Every persisted store across the surfaces (settings, notes, side work,
        // layouts ...), not just the dining ones; device settings stay.
        resetPersistedStores();
        resetProduction();
        setRecentBumps([]);
        setModUsage({});
        setPendingTakeover(null);
        runUndos.current.clear();
      },
    };
    return api;
  }, [engine]);

  const usageFor = useCallback(
    (itemId: string) => {
      const out: Record<string, number> = { ...modDefaults[itemId] };
      for (const [g, n] of Object.entries(modUsage[itemId] ?? {})) out[g] = (out[g] || 0) + n;
      return out;
    },
    [modUsage],
  );

  const confirmTakeover = useCallback(() => {
    const t = pendingTakeover;
    setPendingTakeover(null);
    t?.go();
  }, [pendingTakeover]);

  const value = useMemo<DiningApi>(
    () => ({
      ...actions,
      ...state,
      recentBumps,
      expoActive,
      kitchenMode,
      resPrefs,
      pendingTakeover: pendingTakeover && { orderId: pendingTakeover.orderId, from: pendingTakeover.from },
      usageFor,
      confirmTakeover,
    }),
    [actions, state, recentBumps, expoActive, kitchenMode, resPrefs, pendingTakeover, usageFor, confirmTakeover],
  );

  return <DiningContext.Provider value={value}>{children}</DiningContext.Provider>;
}
