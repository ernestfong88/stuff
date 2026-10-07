/**
 * Cook: the kitchen display on the cook line. One ticket per check and
 * course, showing the plates this screen makes. Tap a plate when it is up,
 * bump the ticket when the course is done. Works from a physical bump bar
 * too.
 */
import { Keyboard } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { now } from '../../lib/clock';
import { useConfig } from '../../store/config';
import { useDining } from '../../store/dining';
import { useSetting } from '../../store/serviceConfig';
import { tableName } from '../../domain/orders';
import { serverName } from '../../domain/servers';
import { cx, useNow } from '../../ui';
import { BumpKeysPage } from '../kitchen/BumpKeysPage';
import { screensForItem } from '../kitchen/kdsScreens';
import { GridMessage, HeaderButton, KitchenHeader, KitchenShell, TicketArea, TicketGrid, TicketSlot } from '../kitchen/KitchenShell';
import { KitchenUnavailable } from '../kitchen/KitchenUnavailable';
import { MenuReference } from '../kitchen/MenuReference';
import { RecallMenu } from '../kitchen/RecallMenu';
import type { SubcategoryChoices } from '../kitchen/subcategories';
import { useBumpBar } from '../kitchen/useBumpBar';
import { useThreshold } from '../kitchen/useThreshold';
import { kitchenPrinters, kitchenScreens, screenOptions, useDeviceScreen, useVenueSettings } from '../kitchen/venueSettings';
import { averageTicketMinutes, bumpLineIds, buildCookTickets, screenLines, ticketStatus, type CookLine, type CookTicket } from './cookTickets';
import { CookTicketCard } from './CookTicketCard';
import s from './Cook.module.css';
import { ScreenPicker } from './ScreenPicker';

const NO_CHOICES: SubcategoryChoices = {};

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
  const closeKeys = useCallback(() => setKeysOpen(false), []);

  const screensOf = useCallback(
    (itemId: string, room: string) => screensForItem(itemId, room, kitchenScreens(settings, room), choices),
    [settings, choices],
  );
  const tickets = useMemo(
    () => buildCookTickets(orders, { screen: screen.key, expoActive, cfg, screensOf }),
    [orders, screen.key, expoActive, cfg, screensOf],
  );

  const bumped = recentBumps.flatMap((b) => {
    const order = orders.find((o) => o.id === b.orderId);
    return order ? [{ ...b, order }] : [];
  });
  const avg = averageTicketMinutes(bumped, now());

  const tapLine = (t: CookTicket, line: CookLine) =>
    dining.setItemKitchenState(t.orderId, line.id, line.cancelled ? 'cleared' : line.kitchenState === 'ready' ? 'cooking' : 'ready');

  /** Cancelled plates the cook has seen leave the ticket. */
  const clearCancelled = (t: CookTicket) => {
    for (const l of ticketStatus(t, screen.key).cancelled) dining.setItemKitchenState(t.orderId, l.id, 'cleared');
  };

  const bumpTicket = (t: CookTicket) => {
    const st = ticketStatus(t, screen.key);
    if (st.onlyCancelled) return clearCancelled(t);
    if (st.allReady && !expoActive) return dining.clearCourse(t.orderId, t.course);
    dining.markCourseReady(t.orderId, t.course, bumpLineIds(t, screen.key, screensOf));
    clearCancelled(t);
  };

  const recallLast = () => {
    const back = bumped.find((b) => b.order.diners.some((d) => d.items.some((i) => i.kitchenState === 'ready')));
    if (back) dining.recallToCooking(back.orderId);
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
            <HeaderButton onClick={() => setMenuOpen(true)} title="Today's entrées: plating and cook notes">
              MENU
            </HeaderButton>
            <RecallMenu
              title="Undo a bump: pulls the ticket back"
              items={bumped.map((b) => ({ id: b.orderId, label: tableName(b.order) + (b.order.server ? ' · ' + serverName(b.order.server) : '') }))}
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
            avg {avg}m
          </span>
        )}
        <ScreenPicker value={screen.key} options={screenOptions(settings)} />
      </KitchenHeader>
      <TicketArea label="Tickets">
        <TicketGrid>
          {tickets.map((t, i) => (
            <TicketSlot key={t.id} index={i}>
              <CookTicketCard
                ticket={t}
                index={i}
                screen={screen.key}
                expoActive={expoActive}
                lateAfter={lateAfter}
                now={clock}
                cfg={cfg}
                selected={i === sel.ticket}
                selectedLine={i === sel.ticket ? sel.line : -1}
                onSelect={(line) => setSel({ ticket: i, line })}
                onTapLine={(line) => tapLine(t, line)}
                onBump={() => bumpTicket(t)}
                onClear={() => dining.clearCourse(t.orderId, t.course)}
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
