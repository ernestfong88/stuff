/**
 * Expo: the pass. Every fired check in promise order, with its courses and
 * what each needs next: mark a course ready, run it, fire the next one,
 * text the resident, hand it over. Works from a bump bar too.
 */
import { Keyboard } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { COMMUNITY_NAME, rooms } from '../../data';
import { dinerName, tableName } from '../../domain/orders';
import { isoDate } from '../../domain/pickup';
import type { AssocMeal } from '../../domain/types';
import { now } from '../../lib/clock';
import { useConfig } from '../../store/config';
import { useQueueHandOff, useTextContext } from '../../store/queueHandOff';
import { useAssocOrders, useDiningActions, useDiningDevice, useDiningOrders } from '../../store/dining';
import { getSetting } from '../../store/serviceConfig';
import { useTick } from '../../ui';
import { BumpKeysPage } from '../kitchen/BumpKeysPage';
import { GridMessage, HeaderButton, KitchenClock, KitchenHeader, KitchenShell, TicketArea, TicketGrid, TicketSlot } from '../kitchen/KitchenShell';
import { KitchenUnavailable } from '../kitchen/KitchenUnavailable';
import { MenuReference } from '../kitchen/MenuReference';
import { RecallMenu } from '../kitchen/RecallMenu';
import { ticketCache, useStableHandlers } from '../kitchen/stableTickets';
import { useBumpBar } from '../kitchen/useBumpBar';
import { useThreshold } from '../kitchen/useThreshold';
import { kitchenHasExpo, kitchenPrinters, useVenueSettings } from '../../store/venueSettings';
import { assocTickets, missedAssocTickets, type AssocStage } from './assocTickets';
import s from './Expo.module.css';
import { ExpoAssociates } from './ExpoAssociates';
import { ExpoTicketCard, type ExpoTicketActions } from './ExpoTicketCard';
import {
  activeLines,
  buildExpoTickets,
  courseIsReady,
  currentCourse,
  EXPO_FILTERS,
  filterTickets,
  nextHeldCourse,
  printCourse,
  type ExpoFilter,
  type ExpoTicket,
} from './expoTickets';
import { printDocument, runnerCopyHtml } from './runnerCopy';

/** The same ticket object for a check that has not changed, so its card skips the redraw. */
const sameTickets = ticketCache<ExpoTicket>();
const NO_KEY: readonly unknown[] = [];

/** The kitchen whose pick up settings apply to associate meals. */
const ASSOC_ROOM = 'sequoia';

/** Per venue: staff mark a pick up collected (the default), or it is done once set out. */
const tracksPickup = (room: string) => getSetting<Record<string, boolean> | undefined>('pud.track')?.[room] !== false;

export default function Expo() {
  const { kitchenMode } = useDiningDevice();
  const settings = useVenueSettings();
  // KDS Settings, Expo screen: No for every kitchen means the cook line clears its own tickets.
  const cookOnly = !Object.keys(rooms).some((room) => kitchenHasExpo(settings, room));
  if (kitchenMode === 'printers' || cookOnly)
    return (
      <KitchenShell>
        <KitchenUnavailable surface="Expo" cookOnly={kitchenMode !== 'printers'} printers={kitchenPrinters(settings, ASSOC_ROOM)} />
      </KitchenShell>
    );
  return <ExpoPass />;
}

function ExpoPass() {
  const dining = useDiningActions();
  const orders = useDiningOrders();
  const assocOrders = useAssocOrders();
  const { recentBumps } = useDiningDevice();
  const cfg = useConfig();
  // Late and the filters move within 15 s; the ticket timers and the clock tick on their own.
  const clock = useTick(15_000);
  const cookLate = useThreshold('cookLate');
  const expoPass = useThreshold('expoPass');
  const fireLate = useThreshold('fireLate');
  const thresholds = useMemo(() => ({ cookLate, expoPass, fireLate }), [cookLate, expoPass, fireLate]);
  const texts = useTextContext();
  const queue = useQueueHandOff();
  const [filter, setFilter] = useState<ExpoFilter>('all');
  const [associates, setAssociates] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeKeys = useCallback(() => setKeysOpen(false), []);

  const settings = useVenueSettings();
  // Only kitchens with an expo station (KDS Settings); the others' servers run their own courses.
  const tickets = useMemo(() => sameTickets(buildExpoTickets(orders.filter((o) => kitchenHasExpo(settings, o.room))), NO_KEY), [orders, settings]);
  const lists = useMemo(() => filterTickets(tickets, clock), [tickets, clock]);
  const shown = lists[filter];
  const today = isoDate(0);
  const tracks = tracksPickup(ASSOC_ROOM);
  const assoc = useMemo(() => assocTickets(assocOrders, today, tracks, clock), [assocOrders, today, tracks, clock]);
  const missed = useMemo(() => missedAssocTickets(assocOrders, today, tracks, clock), [assocOrders, today, tracks, clock]);

  const recalls = useMemo(
    () =>
      recentBumps.flatMap((b) => {
        const order = orders.find((o) => o.id === b.orderId);
        return order && order.diners.some((d) => d.items.some((i) => i.kitchenState === 'cleared')) ? [{ ...b, order }] : [];
      }),
    [recentBumps, orders],
  );

  const recallLabel = (o: ExpoTicket['order']) => (o.queueType ? `${tableName(o)} · ${o.diners[0] ? dinerName(o.diners[0]).split(' ')[0] : ''}` : tableName(o));

  /** Run course c to the table. A ticket cleared by mistake comes back from RECALL. */
  const runCourse = (orderId: string, c: number) => dining.clearCourse(orderId, c);

  /** The last course goes out: the ticket leaves the pass. */
  const bumpOrder = (orderId: string) => dining.clearOrder(orderId);

  /** The same hand-off PU & Delivery does: set out (and texted), or out the door with the runner. */
  const handOff = (t: ExpoTicket) => {
    if (t.order.queueType === 'delivery') queue.leave(t.order);
    else queue.setOut(t.order);
  };

  /** Plates up, with the sides that go on them, so PU & Delivery sees the order ready too. */
  const ready = (t: ExpoTicket, course: number, lineIds: string[]) => {
    const sides = t.order.diners.flatMap((d) => d.items.filter((i) => i.parentId && lineIds.includes(i.parentId)));
    dining.markCourseReady(t.order.id, course, [...lineIds, ...sides.map((i) => i.id)]);
  };

  // Handed to the memoised cards: the same functions every render, running the latest code.
  const actions: ExpoTicketActions = useStableHandlers({
    fire: dining.fireCourseNow,
    setLine: dining.setItemKitchenState,
    ready,
    runCourse,
    bump: bumpOrder,
    handOff,
    refire: dining.remakeLine,
    print: (t: ExpoTicket, label: string) => printDocument(runnerCopyHtml({ ticket: t, course: printCourse(t), label, printedAt: now(), cfg })),
  });

  /** Bump ticket from the bar: fire what is held, else plates up, else run the course. */
  const bumpTicket = (t: ExpoTicket) => {
    const active = activeLines(t);
    if (!active.length) {
      const held = nextHeldCourse(t.order);
      if (held != null) dining.fireCourseNow(t.order.id, held);
      return;
    }
    const cooking = active.filter((l) => l.kitchenState === 'cooking');
    if (cooking.length) return cooking.forEach((l) => dining.setItemKitchenState(t.order.id, l.id, 'ready'));
    if (!courseIsReady(t.lines)) return;
    const c = currentCourse(t.lines) ?? 0;
    if (t.lines.some((l) => l.kitchenState === 'scheduled' && l.course > c)) runCourse(t.order.id, c);
    else bumpOrder(t.order.id);
  };

  const [sel, setSel] = useBumpBar({
    enabled: !keysOpen && !menuOpen && !associates,
    ticketCount: shown.length,
    lineCount: (i) => activeLines(shown[i]).length,
    onBumpItem: (i, li) => {
      const line = activeLines(shown[i])[li];
      if (!line) return false;
      const up = line.kitchenState !== 'ready';
      dining.setItemKitchenState(shown[i].order.id, line.id, up ? 'ready' : 'cooking');
      return up;
    },
    onBumpTicket: (i) => bumpTicket(shown[i]),
    onMenu: () => recalls[0] && dining.recallCleared(recalls[0].orderId),
  });

  const updateAssoc = (id: string, patch: AssocStage & Partial<AssocMeal>, text: string) =>
    dining.setAssocOrders((list) => list.map((m) => (m.id === id ? { ...m, ...patch, log: [...(m.log ?? []), { by: 'Expo', at: now(), text }] } : m)));

  const filterButton = (f: (typeof EXPO_FILTERS)[number]) => (
    <HeaderButton
      key={f.id}
      on={!associates && filter === f.id}
      aria-pressed={!associates && filter === f.id}
      count={lists[f.id].length}
      countTone={f.id === 'unfired' ? 'blue' : 'green'}
      className={s.filter}
      onClick={() => {
        setAssociates(false);
        setFilter(f.id);
        setSel({ ticket: 0, line: 0 });
      }}
    >
      {f.label}
    </HeaderButton>
  );

  if (keysOpen)
    return (
      <KitchenShell>
        <BumpKeysPage onBack={closeKeys} />
      </KitchenShell>
    );

  return (
    <KitchenShell>
      <KitchenHeader
        title="EXPO"
        subtitle={COMMUNITY_NAME}
        ownRow
        actions={
          <>
            <KitchenClock className={s.clock} />
            <HeaderButton onClick={() => setMenuOpen(true)} title="Today's menu: specials, plating and cook notes">
              MENU
            </HeaderButton>
            <RecallMenu
              title="Last bumped, tap to bring back"
              items={recalls.map((b) => ({ id: b.orderId, label: recallLabel(b.order), meta: Math.max(0, Math.floor((clock - b.at) / 60_000)) + 'm ago' }))}
              onRecall={(id) => dining.recallCleared(id)}
            />
            <HeaderButton icon={<Keyboard size={15} strokeWidth={2.5} />} onClick={() => setKeysOpen(true)} title="Bump bar keys">
              BUMP KEYS
            </HeaderButton>
          </>
        }
      >
        <nav className={s.filters} aria-label="Show">
          {EXPO_FILTERS.filter((f) => !f.ready).map(filterButton)}
          <span className={s.readyGroup} role="group" aria-label="Ready to go out">
            <span className={s.readyLabel} aria-hidden="true">
              Ready
            </span>
            {EXPO_FILTERS.filter((f) => f.ready).map(filterButton)}
          </span>
          <HeaderButton
            on={associates}
            aria-pressed={associates}
            outlined
            count={assoc.length}
            countTone="amber"
            className={s.filter}
            onClick={() => setAssociates(true)}
          >
            Associates
          </HeaderButton>
        </nav>
      </KitchenHeader>
      <TicketArea label={associates ? 'Associate meals' : 'Tickets'}>
        {associates ? (
          <ExpoAssociates tickets={assoc} missed={missed} now={clock} onUpdate={updateAssoc} />
        ) : (
          <TicketGrid>
            {shown.map((t, i) => (
              <TicketSlot key={t.id} index={i}>
                <ExpoTicketCard
                  ticket={t}
                  index={i}
                  now={clock}
                  thresholds={thresholds}
                  cfg={cfg}
                  texts={texts}
                  selected={i === sel.ticket}
                  selectedLineId={i === sel.ticket ? (activeLines(t)[sel.line]?.id ?? null) : null}
                  actions={actions}
                />
              </TicketSlot>
            ))}
            {tickets.length === 0 ? (
              <GridMessage title="Pass is clear">Fired tickets line up here in promise order.</GridMessage>
            ) : (
              shown.length === 0 && <GridMessage title="Nothing here right now." />
            )}
          </TicketGrid>
        )}
      </TicketArea>
      <MenuReference open={menuOpen} onClose={() => setMenuOpen(false)} />
    </KitchenShell>
  );
}
