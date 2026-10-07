/**
 * The bartender's screen. Only drinks the venue sends to the bar show; a
 * ticket is made, marked ready, and waits for its server to collect it.
 */
import { GlassWater } from 'lucide-react';
import { getItem, rooms } from '../../data';
import { dinerName } from '../../domain/orders';
import { kitchenItemName, modsText } from '../../domain/menu';
import { serverColor, serverName } from '../../domain/servers';
import { MINUTE } from '../../lib/clock';
import { useVenue } from '../../shell/session';
import { TabletShell } from '../../shell/TabletShell';
import { useConfig } from '../../store/config';
import { useDining } from '../../store/dining';
import { Button, EmptyState, Eyebrow, cx, toast, useNow } from '../../ui';
import { inPlan, useRoomPlan, useTableName } from '../../store/floorLayout';
import { BAR_LATE_MIN, barQueue, roomHasBar, type BarTicket } from './barQueue';
import s from './Bar.module.css';

export default function BarSurface() {
  const [venue] = useVenue();
  const plan = useRoomPlan(venue);
  const cfg = useConfig();
  const { orders } = useDining();
  const t = useNow(15_000);
  const q = barQueue(orders.filter((o) => inPlan(o, plan)));
  const roomName = rooms[venue]?.name ?? 'this venue';

  return (
    <TabletShell>
      <div className={s.scroll}>
        <div className={s.head}>
          <h1 className={s.title}>Bar</h1>
          <span className={s.sub}>
            {roomName} · {q.make.length} to make, {q.waiting.length} waiting for pickup
          </span>
        </div>
        {!roomHasBar(venue, cfg) && !q.make.length && !q.waiting.length && (
          <p className={s.note}>Servers pour their own drinks at {roomName}. A manager can send any drink to the bar in Back Office, Kitchen Routing.</p>
        )}

        <Eyebrow className={s.cap}>To make</Eyebrow>
        {q.make.length ? (
          <div className={s.grid}>
            {q.make.map((x) => (
              <Ticket key={x.order.id} ticket={x} at={t} />
            ))}
          </div>
        ) : (
          <EmptyState compact icon={<GlassWater size={28} strokeWidth={1.8} />} title="Nothing to make">
            Drinks sent to the bar show up here.
          </EmptyState>
        )}

        {q.waiting.length > 0 && (
          <>
            <Eyebrow className={s.cap}>Waiting for pickup</Eyebrow>
            <div className={s.grid}>
              {q.waiting.map((x) => (
                <Ticket key={x.order.id} ticket={x} at={t} done />
              ))}
            </div>
          </>
        )}
      </div>
    </TabletShell>
  );
}

function Ticket({ ticket, at, done }: { ticket: BarTicket; at: number; done?: boolean }) {
  const { markBarUp, serveDrinks, setItemKitchenState } = useDining();
  const cfg = useConfig();
  const name = useTableName();
  const { order, lines } = ticket;
  const mins = Math.max(0, Math.floor((at - ticket.since) / MINUTE));
  const late = !done && mins >= BAR_LATE_MIN;
  const ids = lines.map((l) => l.id);
  /** A slip on a busy bar costs nothing: each tap can be undone from the toast. */
  const undoTo = (state: 'bar' | 'up') => ({ label: 'Undo', onClick: () => ids.forEach((id) => setItemKitchenState(order.id, id, state)) });
  const ready = () => {
    markBarUp(order.id);
    toast(`${name(order)} drinks are ready for pickup`, { tone: 'success', action: undoTo('bar') });
  };
  const pickedUp = () => {
    serveDrinks(order.id, ids);
    toast(`${name(order)} drinks picked up`, { action: undoTo('up') });
  };
  return (
    <article className={cx(s.ticket, late && s.late, done && s.done)} aria-label={`${name(order)}, ${lines.length} drinks`}>
      <div className={s.ticketHead}>
        <span className={s.table}>{name(order)}</span>
        {order.server && (
          <span className={s.server} style={{ background: serverColor(order.server) }}>
            {serverName(order.server)}
          </span>
        )}
        <span className={cx(s.mins, late && s.lateText)}>{mins}m</span>
      </div>
      <ul className={s.lines}>
        {lines.map((l) => {
          const it = getItem(l.itemId);
          const extra = modsText(l.mods, l.note);
          return (
            <li key={l.id} className={s.line}>
              {l.diner.seat ? <span className={s.seat}>S{l.diner.seat}</span> : null}
              <span className={s.drink}>
                <span className={s.drinkName}>{it ? kitchenItemName(it.name, cfg) : 'Drink'}</span>
                {extra && <span className={s.mods}>{extra}</span>}
              </span>
              <span className={s.who}>{dinerName(l.diner).split(' ')[0]}</span>
            </li>
          );
        })}
      </ul>
      {done ? (
        <div className={s.foot}>
          <span className={s.readyText}>Ready. Waiting for {serverName(order.server) || 'the server'}.</span>
          <Button variant="soft" size="lg" onClick={pickedUp}>
            Picked up
          </Button>
        </div>
      ) : (
        <Button variant="success" size="lg" block onClick={ready}>
          Ready for pickup
        </Button>
      )}
    </article>
  );
}
