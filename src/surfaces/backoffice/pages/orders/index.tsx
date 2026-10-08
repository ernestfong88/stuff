import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { rooms, staff } from '../../../../data';
import { dinerPerson, tableName } from '../../../../domain/orders';
import { serverName } from '../../../../domain/servers';
import { useConfig } from '../../../../store/config';
import { useDining } from '../../../../store/dining';
import { Avatar, Button, Chip, EmptyState, SearchField, Tabs, cx } from '../../../../ui';
import { formatDayShort, formatTime } from '../../../../lib/format';
import { now, startOfToday } from '../../../../lib/clock';
import { ANY_DATE, BoPage, BoSelect, DateRangeFilter, isRangeSet, type DateRange } from '../../kit';
import type { BoPageProps } from '../../nav';
import { OrderDetail } from './OrderDetail';
import { buildRows, filterRows, type ChargeFilter, type OrderRow, type StatusFilter } from './orderRows';
import s from './orders.module.css';

/** Order History: every check, filtered and drilled into, with corrections to closed ones. */
export default function OrderHistoryPage(_props: BoPageProps) {
  const { orders, history } = useDining();
  const cfg = useConfig();
  const [query, setQuery] = useState('');
  const [server, setServer] = useState('All');
  const [charge, setCharge] = useState<ChargeFilter>('All');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [range, setRange] = useState<DateRange>(ANY_DATE);
  const [openId, setOpenId] = useState<string | null>(null);
  const all = useMemo(() => buildRows(orders, history, cfg), [orders, history, cfg]);
  const rows = filterRows(all, { query, server, charge, status, range, at: now() });
  const openCount = all.filter((r) => r.open).length;
  const filtered = query !== '' || server !== 'All' || charge !== 'All' || status !== 'all' || isRangeSet(range);
  const total = rows.reduce((sum, r) => sum + r.charged, 0);
  const servers = [...new Set([...staff.map((x) => x.id), ...all.map((r) => r.order.server)])].filter(Boolean);

  return (
    <BoPage title="Order History">
      <div className={s.filters}>
        <Tabs
          aria-label="Checks"
          variant="segmented"
          size="sm"
          value={status}
          onChange={setStatus}
          options={[
            { id: 'all', label: 'All' },
            { id: 'open', label: 'Open', count: openCount },
            { id: 'closed', label: 'Closed' },
          ]}
        />
        <SearchField value={query} onChange={setQuery} placeholder="Resident name" aria-label="Search by resident name" className={s.search} />
        <BoSelect value={server} onChange={(e) => setServer(e.target.value)} aria-label="Associate">
          <option value="All">All associates</option>
          {servers.map((id) => (
            <option key={id} value={id}>
              {staff.find((x) => x.id === id)?.name ?? serverName(id)}
            </option>
          ))}
        </BoSelect>
        <BoSelect value={charge} onChange={(e) => setCharge(e.target.value as ChargeFilter)} aria-label="Charge type">
          <option value="All">All charge types</option>
          <option value="apt">Apartment charge</option>
          <option value="other">Other charge</option>
        </BoSelect>
        <DateRangeFilter value={range} onChange={setRange} />
        <span className={s.summary}>
          {rows.length} {rows.length === 1 ? 'order' : 'orders'} · <strong>${total.toFixed(2).replace(/\.00$/, '')}</strong> charged
        </span>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No orders match">
          Try another name, associate, charge type or dates.
          {filtered && (
            <div className={s.clear}>
              <Button
                size="sm"
                onClick={() => {
                  setQuery('');
                  setServer('All');
                  setCharge('All');
                  setStatus('all');
                  setRange(ANY_DATE);
                }}
              >
                Clear filters
              </Button>
            </div>
          )}
        </EmptyState>
      ) : (
        <ul className={s.list}>
          {rows.map((r) => (
            <OrderItem key={r.order.id} row={r} open={openId === r.order.id} onToggle={() => setOpenId(openId === r.order.id ? null : r.order.id)} />
          ))}
        </ul>
      )}
    </BoPage>
  );
}

function OrderItem({ row, open, onToggle }: { row: OrderRow; open: boolean; onToggle: () => void }) {
  const o = row.order;
  const person = row.lead ? dinerPerson(row.lead) : undefined;
  // Table labels already say the room in a shared space (SQ 3, EG 7); other venues get their name.
  const room = rooms[o.room]?.name ?? '';
  const where = o.queueType || room.includes('/') ? tableName(o) : `${room} ${tableName(o)}`.trim();
  const detailId = `order-${o.id}`;
  const at = o.closedAt ?? o.openedAt;
  const when = at ? (at >= startOfToday() ? formatTime(at) : `${formatDayShort(at)}, ${formatTime(at)}`) : '';
  return (
    <li className={cx(s.card, open && s.cardOpen)}>
      <button className={s.head} onClick={onToggle} aria-expanded={open} aria-controls={detailId}>
        <Avatar person={person ? { id: person.id, name: person.name, photo: person.photo } : { name: row.leadName }} size={32} />
        <span className={s.title}>
          <span className={s.name}>{row.leadName}</span>
          {o.diners.length > 1 && <span className={s.more}> +{o.diners.length - 1}</span>}
          <span className={s.meta}>
            {' '}
            · {where} · {o.meal} · {o.server}
          </span>
          {when && <span className={s.when}>{row.open ? `Opened ${when}` : `Closed ${when}`}</span>}
        </span>
        {row.feedback && (
          <Chip tone={row.feedback.tone} size="xs">
            {row.feedback.text}
          </Chip>
        )}
        {o.comp && (
          <Chip tone="plum" size="xs">
            Comped
          </Chip>
        )}
        <Chip tone={row.open ? 'warning' : 'neutral'} size="xs">
          {row.open ? 'Open' : 'Closed'}
        </Chip>
        <span className={s.amount}>{row.charged > 0 ? `$${row.charged.toFixed(2).replace(/\.00$/, '')}` : '—'}</span>
        <ChevronDown size={16} className={cx(s.chev, open && s.chevOpen)} aria-hidden />
      </button>
      {open && (
        <div id={detailId}>
          <OrderDetail row={row} />
        </div>
      )}
    </li>
  );
}
