import { useState } from 'react';
import { Mic } from 'lucide-react';
import type { Order } from '../../../../domain/types';
import { formatMoneyShort, formatTime } from '../../../../lib/format';
import { useNotes } from '../../../../store/notes';
import { Chip, EmptyState, cx } from '../../../../ui';
import { SummaryTile, SummaryTiles } from '../shared/SummaryTile';
import { TriviaButton } from '../trivia/TriviaButton';
import { VoiceSheet } from '../voice/VoiceSheet';
import type { ClosedCheckRow, ShiftTotals } from './closedChecks';
import { ShiftFaces } from './ShiftFaces';
import s from './ChecksTab.module.css';

/** Notes added at a check, the trivia "?" and the mic for a closed check. */
function RowActions({ order, label, who, locked, onMic }: { order: Order; label: string; who: string; locked: boolean; onMic: () => void }) {
  const notes = useNotes();
  const count = notes.filter((n) => n.oid === order.id && n.by === who).length;
  return (
    <div className={s.actions}>
      {count > 0 && (
        <Chip tone="success" size="md">
          ✓ {count} {count === 1 ? 'note' : 'notes'}
        </Chip>
      )}
      {!locked && <TriviaButton order={order} variant="icon" />}
      {!locked && (
        <button type="button" className={s.mic} onClick={onMic} aria-label={`Voice note about ${label}`} title="Voice note about this table">
          <Mic size={19} aria-hidden />
        </button>
      )}
    </div>
  );
}

/** Checks and payments: the shift's totals and every closed check. */
export function ChecksTab({
  rows,
  totals,
  checkIns,
  who,
  locked,
  onOpenCheck,
}: {
  rows: ClosedCheckRow[];
  totals: ShiftTotals;
  checkIns: number;
  who: string;
  locked: boolean;
  onOpenCheck?: (orderId: string) => void;
}) {
  const [voiceFor, setVoiceFor] = useState<Order | null>(null);
  return (
    <>
      <SummaryTiles>
        <SummaryTile value={totals.checks} label="checks closed" />
        <SummaryTile value={totals.covers} label="covers" />
        <SummaryTile value={formatMoneyShort(totals.card.sum)} label={`card · ${totals.card.count} tx`} color="var(--ocean)" />
        <SummaryTile value={formatMoneyShort(totals.apt.sum)} label={`apartment · ${totals.apt.count}`} color="var(--coast)" />
        <SummaryTile
          value={totals.comps.count}
          label={`comps${totals.comps.count ? ` · ${formatMoneyShort(totals.comps.sum)}` : ''}`}
          color={totals.comps.count ? 'var(--clay-600)' : undefined}
        />
        <SummaryTile value={checkIns} label="table check-ins" color="#2f8c8c" />
      </SummaryTiles>
      <h3 className={s.cap}>Older orders · {rows.length} closed this shift</h3>
      {rows.length ? (
        <ul className={s.list}>
          {rows.map((r) => {
            const open = onOpenCheck ? () => onOpenCheck(r.id) : undefined;
            return (
              <li key={r.id} className={s.row}>
                <button type="button" className={cx(s.main, !open && s.static)} onClick={open} disabled={!open}>
                  <span className={s.when}>
                    <span className={s.table}>{r.table}</span>
                    <span className={s.time}>
                      {formatTime(r.closedAt)} · {r.covers} {r.covers === 1 ? 'cover' : 'covers'}
                    </span>
                  </span>
                  <span className={s.body}>
                    <ShiftFaces order={r.order} />
                    <span className={s.pays}>
                      {r.plan > 0 && <Chip size="md">{r.plan} on plan</Chip>}
                      {r.charges.map((c, i) => (
                        <Chip key={i} size="md" tone="info" className={c.kind === 'apt' ? s.apt : undefined}>
                          {c.kind === 'card' ? 'Card' : 'Apt'} {formatMoneyShort(c.amt)} · {c.who}
                        </Chip>
                      ))}
                      {r.comps.map((c, i) => (
                        <Chip key={i} size="md" tone="warning">
                          Comp · {c.reason} {formatMoneyShort(c.amt)}
                        </Chip>
                      ))}
                    </span>
                  </span>
                </button>
                <RowActions order={r.order} label={r.table} who={who} locked={locked} onMic={() => setVoiceFor(r.order)} />
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState compact title="No closed checks yet this shift">
          Checks you close show up here with how each diner paid.
        </EmptyState>
      )}
      {voiceFor && <VoiceSheet order={voiceFor} onClose={() => setVoiceFor(null)} />}
    </>
  );
}
