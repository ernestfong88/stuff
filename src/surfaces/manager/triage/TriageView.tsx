import { useState } from 'react';
import type { Order } from '../../../domain/types';
import { serverName } from '../../../domain/servers';
import { plural } from '../../../lib/format';
import { useConfig } from '../../../store/config';
import { useDining } from '../../../store/dining';
import { serviceConfig } from '../../../store/serviceConfig';
import { useShared } from '../../../lib/sharedStore';
import { EmptyState, Tabs, cx, useNow } from '../../../ui';
import { useTableName } from '../../../store/floorLayout';
import { StageChip } from '../floor/StageChip';
import { needingHelp, triageByServer, triageRows, type ServerTriage, type TriageRow } from '../floor/triage';
import s from './TriageView.module.css';

type TriageMode = 'table' | 'assoc';

const helpText = (n: number) => (n ? `${n} table${n === 1 ? ' needs' : 's need'} help` : '');

/** __KTriage: where the manager should go next, by table or by associate. */
export function TriageView({ onOpen }: { onOpen: (o: Order) => void }) {
  const { orders } = useDining();
  const cfg = useConfig();
  // Thresholds live in the service config: re-render when Back Office changes them,
  // and every 15 seconds so the minutes keep counting.
  useShared(serviceConfig);
  useNow(15_000);
  const [mode, setMode] = useState<TriageMode>('table');
  const name = useTableName();

  const rows = triageRows(orders, { cfg });
  const need = needingHelp(rows);
  const fine = rows.filter((r) => !r.why.length);
  const late = need.filter((r) => r.why[0].late).length;

  return (
    <div className={s.scroll}>
      <div className={s.head}>
        <Tabs<TriageMode>
          variant="segmented"
          size="md"
          value={mode}
          onChange={setMode}
          aria-label="Group triage"
          options={[
            { id: 'table', label: 'By table' },
            { id: 'assoc', label: 'By associate' },
          ]}
        />
        <span className={s.summary}>
          <b className={cx(late > 0 && s.red)}>{need.length ? helpText(need.length) : 'Nothing needs you right now'}</b>
          {late > 0 && ` · ${late} past the mark`}
        </span>
      </div>

      {!rows.length ? (
        <EmptyState title="No tables open">Open checks show here when a table needs a hand.</EmptyState>
      ) : mode === 'table' ? (
        <>
          <div className={s.grid}>
            {need.map((r) => (
              <TriageCard key={r.order.id} row={r} name={name(r.order)} onOpen={onOpen} />
            ))}
          </div>
          {fine.length > 0 && <p className={s.fine}>Fine for now: {fine.map((r) => name(r.order)).join(', ')}</p>}
        </>
      ) : (
        <ol className={s.servers}>
          {triageByServer(rows).map((x, i) => (
            <ServerCard key={x.server} rank={i + 1} data={x} name={name} onOpen={onOpen} />
          ))}
        </ol>
      )}
    </div>
  );
}

function TriageCard({ row, name, onOpen }: { row: TriageRow; name: string; onOpen: (o: Order) => void }) {
  const [w, ...more] = row.why;
  return (
    <button className={cx(s.card, w.late ? s.lateEdge : s.watchEdge)} onClick={() => onOpen(row.order)}>
      <span className={s.cardHead}>
        <span className={s.table}>{name}</span>
        <span className={s.server}>{serverName(row.order.server)}</span>
        <StageChip stage={row.stage.key} />
      </span>
      <span className={cx(s.why, w.late ? s.red : s.amber)}>{w.text}</span>
      <span className={cx(s.help, w.late ? s.helpLate : s.helpWatch)}>
        <span className={cx(s.helpTag, w.late ? s.red : s.amber)}>Help</span>
        <span className={s.act}>{w.act}</span>
      </span>
      {more.length > 0 && <span className={s.also}>Also: {more.map((x) => x.text).join(' · ')}</span>}
    </button>
  );
}

function ServerCard({ rank, data, name, onOpen }: { rank: number; data: ServerTriage; name: (o: Order) => string; onOpen: (o: Order) => void }) {
  const tone = data.late ? s.lateEdge : data.need.length ? s.watchEdge : s.goodEdge;
  return (
    <li className={cx(s.serverCard, tone)}>
      <div className={s.serverHead}>
        <span className={s.rank}>{rank}</span>
        <span className={s.serverName}>{serverName(data.server)}</span>
        <span className={cx(s.serverState, data.late ? s.red : data.need.length ? s.amber : s.green)}>
          {data.need.length ? helpText(data.need.length) + (data.late ? ` · ${data.late} past the mark` : '') : 'All good'}
        </span>
        <span className={s.load}>
          {plural(data.rows.length, 'table')} · {data.covers} covers
        </span>
      </div>
      {data.need.length > 0 && (
        <div className={s.rows}>
          {data.need.map((r) => {
            const w = r.why[0];
            return (
              <button key={r.order.id} className={s.row} onClick={() => onOpen(r.order)}>
                <span className={s.rowTable}>{name(r.order)}</span>
                <span className={s.rowAct}>{w.act}</span>
                <span className={cx(s.rowWhy, w.late ? s.red : s.amber)}>{w.text}</span>
                <StageChip stage={r.stage.key} />
              </button>
            );
          })}
        </div>
      )}
    </li>
  );
}
