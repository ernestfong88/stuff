import { Check, ShoppingBag, Truck } from 'lucide-react';
import type { MouseEvent } from 'react';
import { getItem } from '../../data';
import type { DiningConfig } from '../../domain/config';
import { kitchenItemName } from '../../domain/menu';
import { dinerName, tableName } from '../../domain/orders';
import { serverName } from '../../domain/servers';
import { formatElapsed, formatTime } from '../../lib/format';
import { firstSend } from '../../domain/courses';
import { cx } from '../../ui';
import { DinerPills } from '../kitchen/DinerPills';
import { linesByDiner, plateDetails, ticketStatus, type CookLine, type CookTicket } from './cookTickets';
import s from './CookTicketCard.module.css';

export interface CookTicketCardProps {
  ticket: CookTicket;
  /** Position on screen; 0 to 9 can be jumped to from the bump bar. */
  index: number;
  screen: string;
  expoActive: boolean;
  /** Minutes on the fire before the ticket turns red. */
  lateAfter: number;
  now: number;
  cfg: DiningConfig;
  selected: boolean;
  /** Highlighted line (position among this screen's plates), or -1. */
  selectedLine: number;
  onSelect: (line: number) => void;
  onTapLine: (line: CookLine) => void;
  onBump: () => void;
  onClear: () => void;
  onClearCancelled: () => void;
}

export function CookTicketCard(p: CookTicketCardProps) {
  const { ticket: t, screen, cfg } = p;
  const o = t.order;
  const status = ticketStatus(t, screen);
  // A ticket whose plates are all up is no longer late on the line.
  const late = !status.allReady && p.now - t.firedAt >= p.lateAfter * 60_000;
  const groups = linesByDiner(t, screen);
  const name = (itemId: string) => kitchenItemName(getItem(itemId)?.name ?? '', cfg);
  const toGo = t.lines.some((l) => l.toGo && !l.cancelled);
  const where = tableName(o);
  let position = -1;

  return (
    <article
      className={cx(s.ticket, late && s.late, status.allReady && s.ready, p.selected && s.selected)}
      onClick={() => p.onSelect(0)}
      aria-label={`${where}, ${o.queueType ? 'all together' : 'course ' + t.course}${late ? ', late' : ''}`}
    >
      <header className={s.head}>
        {p.index < 10 && (
          <span className={s.seq} title="Bump bar quick select">
            {p.index}
          </span>
        )}
        <span className={s.where}>
          {o.queueType === 'delivery' ? <Truck size={17} strokeWidth={2.5} /> : o.queueType === 'pickup' ? <ShoppingBag size={17} strokeWidth={2.5} /> : null}
          <span className={s.table}>{where}</span>
          {o.server && <span className={s.server}>· {serverName(o.server)}</span>}
        </span>
        {toGo && <span className={s.togo}>TO GO</span>}
        <span className={s.course}>{o.queueType ? 'ALL' : 'C' + t.course}</span>
        {!o.queueType && (
          <span className={s.inAt} title="When the table's order first went to the kitchen">
            IN {formatTime(firstSend(o) ?? t.firedAt)}
          </span>
        )}
        <span className={s.timer}>{formatElapsed(p.now - t.firedAt)}</span>
      </header>

      <div className={s.body}>
        {groups.map(({ diner, lines }) => {
          const live = lines.filter((l) => !l.cancelled);
          const done = live.length > 0 && live.every((l) => l.kitchenState === 'ready');
          return (
            <section key={diner.id} className={cx(s.diner, done && s.dinerDone)}>
              <div className={s.dinerHead}>
                <span className={s.dinerName}>{dinerName(diner)}</span>
                <span className={s.pills}>
                  <DinerPills diner={diner} />
                </span>
              </div>
              {lines.map((line) => {
                position += 1;
                const at = position;
                return (
                  <PlateLine
                    key={line.id}
                    line={line}
                    name={name}
                    defaultSidesOnLine={cfg.defaultSidesOnLine}
                    highlighted={p.selected && p.selectedLine === at}
                    onTap={() => {
                      p.onSelect(at);
                      p.onTapLine(line);
                    }}
                  />
                );
              })}
            </section>
          );
        })}
      </div>

      <footer className={s.foot}>
        {status.onlyCancelled ? (
          <button className={cx(s.footBtn, s.footCancel)} onClick={stop(p.onClearCancelled)}>
            Seen · clear cancelled
          </button>
        ) : status.allReady && !p.expoActive ? (
          <button className={cx(s.footBtn, s.footClear)} onClick={stop(p.onClear)}>
            Picked up · clear
          </button>
        ) : status.allReady ? (
          <div className={cx(s.footBtn, s.footWait)}>Ready at Expo</div>
        ) : (
          <button className={cx(s.footBtn, s.footBump)} onClick={stop(p.onBump)}>
            Bump ticket
          </button>
        )}
      </footer>
    </article>
  );
}

const stop = (fn: () => void) => (e: MouseEvent) => {
  e.stopPropagation();
  fn();
};

function PlateLine({
  line,
  name,
  defaultSidesOnLine,
  highlighted,
  onTap,
}: {
  line: CookLine;
  name: (itemId: string) => string;
  defaultSidesOnLine: boolean;
  highlighted: boolean;
  onTap: () => void;
}) {
  const ready = line.kitchenState === 'ready';
  const cancelled = !!line.cancelled;
  const d = plateDetails(line, { defaultSidesOnLine, name });
  const label = name(line.itemId);
  return (
    <button
      className={cx(s.line, ready && s.lineReady, cancelled && s.lineCancelled, line.rush && !ready && s.lineRush, highlighted && s.lineOn)}
      onClick={(e) => {
        e.stopPropagation();
        onTap();
      }}
      aria-pressed={cancelled ? undefined : ready}
      title={cancelled ? 'Cancelled: tap once you have seen it' : ready ? 'Up. Tap to put it back on the line' : 'Tap when the plate is up'}
    >
      <span className={s.lineTop}>
        <span className={cx(s.check, ready && s.checkOn, cancelled && s.checkX)} aria-hidden="true">
          {cancelled ? '×' : ready ? <Check size={14} strokeWidth={3.5} /> : null}
        </span>
        {line.rush && !ready && <span className={s.remake}>REMAKE</span>}
        <span className={s.item}>{label}</span>
        {cancelled && <span className={s.cancelTag}>CANCELLED</span>}
        {line.toGo && !cancelled && <span className={s.togo}>TO GO</span>}
      </span>
      {d.callouts.map((c) => (
        <span key={'c' + c} className={cx(s.detail, s.callout)}>
          SIDE · {c}
        </span>
      ))}
      {d.defaults.map((c) => (
        <span key={'d' + c} className={s.detail}>
          + {c}
        </span>
      ))}
      {d.noSides && <span className={cx(s.detail, s.noSides)}>NO SIDES</span>}
      {d.mods && <span className={cx(s.detail, s.mods)}>{d.mods}</span>}
      {d.note && <span className={cx(s.detail, s.note)}>“{d.note}”</span>}
    </button>
  );
}
