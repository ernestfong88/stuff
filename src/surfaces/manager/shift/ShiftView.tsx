import { useState } from 'react';
import { CheckCircle2, Download } from 'lucide-react';
import { serverName } from '../../../domain/servers';
import type { Order } from '../../../domain/types';
import { now, startOfToday } from '../../../lib/clock';
import { firstName, formatDayLong, formatMoneyShort, formatTime, plural } from '../../../lib/format';
import { isoDate } from '../../../domain/pickup';
import { useMe } from '../../../shell/session';
import { useConfig } from '../../../store/config';
import { useDiningHistory, useDiningOrders } from '../../../store/dining';
import { useNotes } from '../../../store/notes';
import { Button, Eyebrow, cx } from '../../../ui';
import { useTableName } from '../../../store/floorLayout';
import { mealOf, shiftMeal } from '../../../domain/metrics/stepsOfService';
import { TICKET_TIMES, feedbackSummary, formatMinutes, shiftMoney, ticketTimes, ticketWeek } from './closingReport';
import { signOffShift, useSignOff } from './signOff';
import { SignaturePad } from './SignaturePad';
import s from './ShiftView.module.css';

/** __KMgrShift: one closing report for the whole shift, signed off by the manager. */
export function ShiftView({ onOpen }: { onOpen: (o: Order) => void }) {
  const orders = useDiningOrders();
  const history = useDiningHistory();
  const cfg = useConfig();
  const notes = useNotes();
  const me = useMe();
  const name = useTableName();
  const [signing, setSigning] = useState(false);

  const t0 = startOfToday();
  const tables = orders.filter((o) => !o.queueType);
  const meal = shiftMeal(tables);
  const ml = meal.toLowerCase();
  const closed = history.filter((o) => (o.closedAt ?? 0) >= t0 && o.diners.length);
  const money = shiftMoney(closed, cfg);
  const open = tables.filter((o) => !o.closedAt);
  const times = ticketTimes([...tables, ...closed.filter((o) => !o.queueType && mealOf(o) === meal)], cfg);
  const servers = [...new Set([...tables, ...closed].filter((o) => !o.queueType).map((o) => o.server))];
  const feedback = feedbackSummary(notes.filter((n) => n.kind === 'fb' && n.at >= t0));
  const fbCount = notes.filter((n) => n.kind === 'fb' && n.at >= t0).length;
  const day = isoDate(0);
  const signed = useSignOff(day, meal);

  const exportCopy = () => {
    const lines = [
      `Closing report, ${formatDayLong(now())}, ${meal}`,
      `Servers: ${servers.map(serverName).join(', ')}`,
      '',
      `Total charges completed: ${formatMoneyShort(money.total)} (card ${formatMoneyShort(money.card)}, apartment ${formatMoneyShort(money.apt)})`,
      `Comps: ${money.comps}${money.comps ? ` (${formatMoneyShort(money.compTotal)})` : ''}`,
      `Checks closed: ${money.checks} (${money.covers} covers)`,
      '',
      ...TICKET_TIMES.map((d) => `${d.label}: ${formatMinutes(times[d.key])}`),
      '',
      feedback ? feedback.head : 'No feedback recorded today.',
      '',
      signed ? `Signed by ${signed.by} at ${formatTime(signed.at)}` : 'Not signed off yet',
    ];
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `closing-report-${day}-${ml}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={s.scroll}>
      <div className={s.page}>
        <div className={s.head}>
          <h2 className={s.title}>Closing report</h2>
          <span className={s.sub}>
            {formatDayLong(now())} · {meal} · {servers.map(serverName).join(', ')}
          </span>
          <span className={cx(s.state, signed ? s.stateDone : open.length ? s.stateOpen : s.stateReady)} role="status">
            {signed ? `Signed off by ${firstName(signed.by)}` : open.length ? `${plural(open.length, 'table')} still open` : 'Ready to sign off'}
          </span>
        </div>

        <section className={s.box}>
          <Eyebrow>What we made</Eyebrow>
          <div className={s.stats}>
            <BigStat value={formatMoneyShort(money.total)} label="Total charges completed" tone="ocean" sub={`Card ${formatMoneyShort(money.card)} · apartment ${formatMoneyShort(money.apt)}`} />
            <BigStat value={String(money.comps)} label="Comps" tone={money.comps ? 'clay' : undefined} sub={money.comps ? `${formatMoneyShort(money.compTotal)} total` : 'None'} />
            <BigStat value={String(money.checks)} label="Checks closed" sub={plural(money.covers, 'cover')} />
          </div>
        </section>

        <section className={s.box}>
          <Eyebrow>
            Ticket times, {ml} against last {ml}
          </Eyebrow>
          <div className={s.stats}>
            {TICKET_TIMES.map((d) => {
              const v = times[d.key];
              const week = ticketWeek(d.key, meal);
              const delta = v != null ? v - week[week.length - 1] : null;
              return (
                <BigStat
                  key={d.key}
                  small
                  value={formatMinutes(v)}
                  label={d.label}
                  sub={delta == null ? 'No checks yet' : `${Math.abs(delta).toFixed(1)} min ${delta <= 0 ? 'faster' : 'slower'} than last ${ml}`}
                  subTone={delta == null ? undefined : delta <= 0 ? 'good' : 'bad'}
                />
              );
            })}
          </div>
        </section>

        <section className={s.box}>
          <Eyebrow>Feedback today{fbCount ? ` · ${plural(fbCount, 'comment')}` : ''}</Eyebrow>
          {feedback ? (
            <>
              <p className={s.fbHead}>{feedback.head}</p>
              <div className={s.fbCols}>
                <div>
                  <div className={cx(s.fbTitle, s.good)}>Going well</div>
                  {feedback.liked.length ? (
                    feedback.liked.slice(0, 3).map(([dish, n]) => (
                      <div key={dish} className={s.fbLine}>
                        {dish} · {n} positive
                      </div>
                    ))
                  ) : (
                    <div className={s.muted}>Nothing yet</div>
                  )}
                </div>
                <div>
                  <div className={cx(s.fbTitle, s.bad)}>To look at</div>
                  {feedback.issues.length ? (
                    feedback.issues.slice(0, 3).map((i) => (
                      <div key={i.key} className={s.fbLine}>
                        {i.label.charAt(0).toUpperCase() + i.label.slice(1)}
                        {i.dishes.length ? ` · ${i.dishes.join(', ')}` : ''}
                      </div>
                    ))
                  ) : (
                    <div className={s.muted}>Nothing flagged</div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className={s.muted}>No feedback recorded today.</div>
          )}
        </section>

        <section className={cx(s.box, signed ? s.signed : open.length ? s.blocked : null)}>
          <h3 className={s.signTitle}>{signed ? 'Shift signed off' : 'Sign off on this shift'}</h3>
          {signed ? (
            <div className={s.signedLine}>
              <CheckCircle2 size={16} strokeWidth={2.5} />
              Signed by {signed.by} at {formatTime(signed.at)}
            </div>
          ) : open.length ? (
            <>
              <p className={s.blockedText}>
                {open.length === 1 ? 'This table needs' : `These ${open.length} tables need`} to be closed before this shift can be signed off.
              </p>
              <p className={s.how}>Tap a table to open its check.</p>
              <ul className={s.openList}>
                {open.map((o: Order) => (
                  <li key={o.id}>
                    <button className={s.openChip} onClick={() => onOpen(o)}>
                      {name(o)}
                      <span className={s.openServer}>{serverName(o.server)}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className={s.signActions}>
                <Button size="lg" icon={<Download size={16} />} onClick={exportCopy}>
                  Export a copy so far
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className={s.allClosed}>Every table is closed.</p>
              {!signing && (
                <div className={s.signActions}>
                  <Button size="lg" variant="dark" onClick={() => setSigning(true)}>
                    Sign off and end shift
                  </Button>
                  <Button size="lg" icon={<Download size={16} />} onClick={exportCopy}>
                    Export a copy
                  </Button>
                </div>
              )}
              {signing && (
                <SignaturePad
                  name={me.name}
                  onCancel={() => setSigning(false)}
                  onSign={() => {
                    signOffShift(day, meal, me.name, now());
                    setSigning(false);
                  }}
                />
              )}
            </>
          )}
          {signed && (
            <div className={s.signActions}>
              <Button icon={<Download size={16} />} onClick={exportCopy}>
                Export a copy
              </Button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function BigStat({ value, label, sub, tone, subTone, small }: { value: string; label: string; sub: string; tone?: 'ocean' | 'clay'; subTone?: 'good' | 'bad'; small?: boolean }) {
  return (
    <div className={s.stat}>
      <div className={cx(s.statValue, small && s.statSmall, tone && s[tone])}>{value}</div>
      <div className={s.statLabel}>{label}</div>
      <div className={cx(s.statSub, subTone && s[subTone])}>{sub}</div>
    </div>
  );
}
