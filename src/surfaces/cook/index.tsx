/**
 * Cook: the kitchen display on the cook line. One ticket per check and
 * course, showing the plates this screen makes. Tap a plate when it is up,
 * bump the ticket when the course is done. Works from a physical bump bar
 * too.
 */
import { Keyboard, ListOrdered } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { now } from '../../lib/clock';
import { safeStorage } from '../../lib/storage';
import { formatTime } from '../../lib/format';
import { useConfig } from '../../store/config';
import { useDining } from '../../store/dining';
import { useSetting } from '../../store/serviceConfig';
import { getItem } from '../../data';
import { kitchenItemName } from '../../domain/menu';
import { tableName } from '../../domain/orders';
import { serverName } from '../../domain/servers';
import { cx, useNow } from '../../ui';
import { BumpKeysPage } from '../kitchen/BumpKeysPage';
import { screensForItem } from '../../domain/kdsScreens';
import { GridMessage, HeaderButton, KitchenHeader, KitchenShell, TicketArea, TicketGrid, TicketSlot } from '../kitchen/KitchenShell';
import { KitchenUnavailable } from '../kitchen/KitchenUnavailable';
import { MenuReference } from '../kitchen/MenuReference';
import { RecallMenu } from '../kitchen/RecallMenu';
import type { SubcategoryChoices } from '../../domain/subcategories';
import { useBumpBar } from '../kitchen/useBumpBar';
import { useThreshold } from '../kitchen/useThreshold';
import { kitchenHasExpo, kitchenPrinters, kitchenScreens, screenOptions, useDeviceScreen, useVenueSettings } from '../../store/venueSettings';
import { AllDayBar } from './AllDayBar';
import { allDayCounts, averageTicketMinutes, bumpLineIds, buildCookTickets, screenLines, ticketStatus, type CookLine, type CookTicket } from './cookTickets';
import { CookTicketCard } from './CookTicketCard';
import s from './Cook.module.css';
import { ScreenPicker } from './ScreenPicker';

const NO_CHOICES: SubcategoryChoices = {};
/** Whether this device shows the all day strip. */
const ALL_DAY_KEY = 'kisco_cook_allday';

export default function Cook() {
  const { kitchenMode } = useDining();
  const settings = useVenueSettings();
  const screen = useDeviceScreen();
  if (kitchenMode === 'printers')
    return (
      <KitchenShell>
        <KitchenUnavailable surface="Cook Line" printers={kitchenPrinters(settings, screen.room)} />
      </KitchenShell>
    );
  return <CookLine />;
}

function CookLine() {
  const dining = useDining();
  const { orders, expoActive, recentBumps } = dining;
  const settings = useVenueSettings();
  const screen = useDeviceScreen();
  const cfg = useConfig();
  const choices = useSetting<SubcategoryChoices | undefined>('csub') ?? NO_CHOICES;
  const lateAfter = useThreshold('cookLate');
  const clock = useNow(1000);
  const [keysOpen, setKeysOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [allDay, setAllDay] = useState(() => safeStorage.get(ALL_DAY_KEY) === '1');
  const closeKeys = useCallback(() => setKeysOpen(false), []);

  const screensOf = useCallback(
    (itemId: string, room: string) => screensForItem(itemId, room, kitchenScreens(settings, room), choices),
    [settings, choices],
  );
  // Per kitchen: KDS Settings says whether it has an expo station, and the Expo screen's phase must be on.
  const expoAt = useCallback((room: string) => expoActive && kitchenHasExpo(settings, room), [expoActive, settings]);
  const tickets = useMemo(
    () => buildCookTickets(orders, { screen: screen.key, expoActive: expoAt, cfg, screensOf }),
    [orders, screen.key, expoAt, cfg, screensOf],
  );

  const bumped = recentBumps.flatMap((b) => {
    const order = orders.find((o) => o.id === b.orderId);
    return order ? [{ ...b, order }] : [];
  });
  const avg = averageTicketMinutes(bumped, now());
  // Only tickets that still have plates up can be pulled back; once expo runs them there is nothing to recall.
  const recallable = bumped.filter((b) => b.order.diners.some((d) => d.items.some((i) => i.kitchenState === 'ready')));
  const counts = allDayCounts(tickets, screen.key, (id) => kitchenItemName(getItem(id)?.name ?? '', cfg));

  const toggleAllDay = () => {
    safeStorage.set(ALL_DAY_KEY, allDay ? '0' : '1');
    setAllDay(!allDay);
  };

  const tapLine = (t: CookTicket, line: CookLine) =>
    dining.setItemKitchenState(t.orderId, line.id, line.cancelled ? 'cleared' : line.kitchenState === 'ready' ? 'cooking' : 'ready');

  /** Cancelled plates the cook has seen leave the ticket. */
  const clearCancelled = (t: CookTicket) => {
    for (const l of ticketStatus(t, screen.key).cancelled) dining.setItemKitchenState(t.orderId, l.id, 'cleared');
  };

  /** Picked up, without an expo station: the course leaves the line. */
  const clearTicket = (t: CookTicket) => dining.clearCourse(t.orderId, t.course);

  const bumpTicket = (t: CookTicket) => {
    const st = ticketStatus(t, screen.key);
    if (st.onlyCancelled) return clearCancelled(t);
    if (st.allReady && !expoAt(t.order.room)) return clearTicket(t);
    dining.markCourseReady(t.orderId, t.course, bumpLineIds(t, screen.key, screensOf));
    clearCancelled(t);
  };

  const recallLast = () => {
    if (recallable[0]) dining.recallToCooking(recallable[0].orderId);
  };

  const [sel, setSel] = useBumpBar({
    enabled: !keysOpen && !menuOpen,
    ticketCount: tickets.length,
    lineCount: (i) => screenLines(tickets[i], screen.key).length,
    onBumpItem: (i, li) => {
      const line = screenLines(tickets[i], screen.key)[li];
      if (!line) return false;
      tapLine(tickets[i], line);
      return !line.cancelled && line.kitchenState !== 'ready';
    },
    onBumpTicket: (i) => bumpTicket(tickets[i]),
    onMenu: recallLast,
  });

  if (keysOpen)
    return (
      <KitchenShell>
        <BumpKeysPage onBack={closeKeys} />
      </KitchenShell>
    );

  return (
    <KitchenShell>
      <KitchenHeader
        title={'COOK · ' + screen.name.toUpperCase()}
        subtitle={screen.roomName}
        actions={
          <>
            <span className={s.clock} aria-label="Time">
              {formatTime(clock)}
            </span>
            <HeaderButton
              icon={<ListOrdered size={15} strokeWidth={2.5} />}
              on={allDay}
              aria-pressed={allDay}
              onClick={toggleAllDay}
              title="How many of each plate are still to make"
            >
              ALL DAY
            </HeaderButton>
            <HeaderButton onClick={() => setMenuOpen(true)} title="Today's entrées: plating and cook notes">
              MENU
            </HeaderButton>
            <RecallMenu
              title="Undo a bump: pulls the ticket back"
              items={recallable.map((b) => ({ id: b.orderId, label: tableName(b.order) + (b.order.server ? ' · ' + serverName(b.order.server) : '') }))}
              onRecall={(id) => dining.recallToCooking(id)}
            />
            <HeaderButton icon={<Keyboard size={15} strokeWidth={2.5} />} onClick={() => setKeysOpen(true)} title="Bump bar keys">
              BUMP KEYS
            </HeaderButton>
          </>
        }
      >
        {avg != null && (
          <span className={cx(s.avg, avg <= 12 ? s.avgGood : s.avgSlow)} title="Average minutes from fire to bump, last hour">
            Avg ticket {avg} min
          </span>
        )}
        <ScreenPicker value={screen.key} options={screenOptions(settings)} />
      </KitchenHeader>
      {allDay && <AllDayBar counts={counts} />}
      <TicketArea label="Tickets">
        <TicketGrid>
          {tickets.map((t, i) => (
            <TicketSlot key={t.id} index={i}>
              <CookTicketCard
                ticket={t}
                index={i}
                screen={screen.key}
                expoActive={expoAt(t.order.room)}
                lateAfter={lateAfter}
                now={clock}
                cfg={cfg}
                selected={i === sel.ticket}
                selectedLine={i === sel.ticket ? sel.line : -1}
                onSelect={(line) => setSel({ ticket: i, line })}
                onTapLine={(line) => tapLine(t, line)}
                onBump={() => bumpTicket(t)}
                onClear={() => clearTicket(t)}
                onClearCancelled={() => clearCancelled(t)}
              />
            </TicketSlot>
          ))}
          {tickets.length === 0 && <GridMessage title="Line is clear." />}
        </TicketGrid>
      </TicketArea>
      <MenuReference open={menuOpen} onClose={() => setMenuOpen(false)} entreesOnly />
    </KitchenShell>
  );
}
