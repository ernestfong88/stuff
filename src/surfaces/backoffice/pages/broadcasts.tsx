import { useState } from 'react';
import { Megaphone, Trash2 } from 'lucide-react';
import type { BoPageProps } from '../nav';
import { BoPage, BoSection } from '../kit';
import { COMMUNITY_NAME, staff } from '../../../data';
import type { Broadcast } from '../../../domain/types';
import { DAY, now, today } from '../../../lib/clock';
import { formatDayShort, formatTime } from '../../../lib/format';
import { uid } from '../../../lib/id';
import { useDining } from '../../../store/dining';
import { allNotices, setNoticeList, useNotices, type NoticesState } from '../../../store/notices';
import { Button, Chip, TextArea, toast, useConfirm } from '../../../ui';
import s from './broadcasts.module.css';

/** "2026-10-07" for a date input. */
const isoDate = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** A date input's value as local time: the start of the day, or its last moment. */
const fromIsoDate = (iso: string, endOfDay = false) => {
  const [y, m, d] = iso.split('-').map(Number);
  return endOfDay ? new Date(y, m - 1, d, 23, 59, 59, 999).getTime() : new Date(y, m - 1, d).getTime();
};

/** Who has acknowledged a notice, out of the servers who should. */
function Acks({ notice, state, servers }: { notice: Broadcast; state: NoticesState; servers: string[] }) {
  const acks = state.acks[notice.id] ?? {};
  const who = [...new Set([...servers, ...Object.keys(acks)])];
  const yes = who.filter((x) => acks[x]);
  const no = who.filter((x) => !acks[x]);
  return (
    <div className={s.acks}>
      <span className={yes.length ? s.acksYes : s.acksNone}>
        {yes.length} of {who.length} servers acknowledged
      </span>
      {yes.length > 0 && ` · ${yes.map((x) => `${x} ${formatTime(acks[x])}`).join(', ')}`}
      {no.length > 0 && <span className={s.waiting}> · waiting on {no.join(', ')}</span>}
    </div>
  );
}

/** Broadcasts: notices servers open from the Notices button and acknowledge with Got it. */
export default function Page(_props: BoPageProps) {
  const state = useNotices();
  const { orders } = useDining();
  const [ask, confirmDialog] = useConfirm();
  const [message, setMessage] = useState('');
  const [from, setFrom] = useState(() => isoDate(now()));
  const [until, setUntil] = useState(() => isoDate(now() + 7 * DAY));
  const list = allNotices(state);
  const servers = [...new Set([...staff.map((x) => x.initials), ...orders.filter((o) => !o.queueType).map((o) => o.server)])];
  const t = today().getTime();
  const badDates = fromIsoDate(until, true) < fromIsoDate(from);

  const publish = () => {
    const text = message.trim();
    if (!text || badDates) return;
    const b: Broadcast = { id: uid('bc'), scope: COMMUNITY_NAME, message: text, startDt: fromIsoDate(from), endDt: fromIsoDate(until, true), createdOn: now() };
    setNoticeList([b, ...list]);
    setMessage('');
    toast('Broadcast published', { tone: 'success' });
  };

  const remove = async (b: Broadcast) => {
    const ok = await ask({
      title: 'Remove broadcast?',
      message: `“${b.message}” will stop showing on every device immediately.`,
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (!ok) return;
    setNoticeList(list.filter((x) => x.id !== b.id));
    toast('Broadcast removed');
  };

  return (
    <BoPage title="Broadcasts" sub="Servers open these from the Notices button on their tablet and tap Got it, so you can see who has read each one.">
      <div className={s.grid}>
        <BoSection title="New broadcast">
          <div className={s.form}>
            <TextArea
              label="Message"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. Sequoia closes at 2 PM Thursday for deep clean"
            />
            <div className={s.dates}>
              <label className={s.field}>
                <span>Show from</span>
                <input type="date" className={s.date} value={from} onChange={(e) => setFrom(e.target.value)} />
              </label>
              <label className={s.field}>
                <span>Expire by</span>
                <input type="date" className={s.date} value={until} min={from} onChange={(e) => setUntil(e.target.value)} />
              </label>
            </div>
            {badDates && <p className={s.error}>The expiry date is before the start date.</p>}
            <div>
              <Button variant="primary" icon={<Megaphone size={15} />} disabled={!message.trim() || badDates} onClick={publish}>
                Publish broadcast
              </Button>
            </div>
            <p className={s.note}>Broadcasts are scoped to {COMMUNITY_NAME}. Home Office broadcasts come from the home office and show at every community.</p>
          </div>
        </BoSection>
        <BoSection title="Posted" sub={`${list.length} ${list.length === 1 ? 'broadcast' : 'broadcasts'}`}>
          {!list.length && <p className={s.empty}>No broadcasts yet. Write one on the left.</p>}
          <ul className={s.list}>
            {list.map((b) => {
              const live = b.startDt <= t && b.endDt >= t;
              const expired = b.endDt < t;
              return (
                <li key={b.id} className={s.item}>
                  <div className={s.itemBody}>
                    <div className={s.message}>{b.message}</div>
                    <div className={s.range}>
                      {formatDayShort(b.startDt)} → {formatDayShort(b.endDt)}
                    </div>
                    <Acks notice={b} state={state} servers={servers} />
                  </div>
                  {b.scope === 'HO' ? (
                    <Chip tone="warning">HO · all communities</Chip>
                  ) : live ? (
                    <Chip tone="success">Live</Chip>
                  ) : expired ? (
                    <Chip>Expired</Chip>
                  ) : (
                    <Chip tone="info">Scheduled</Chip>
                  )}
                  {b.scope !== 'HO' && (
                    <Button size="sm" variant="softDanger" iconOnly aria-label="Remove broadcast" icon={<Trash2 size={14} />} onClick={() => remove(b)} />
                  )}
                </li>
              );
            })}
          </ul>
        </BoSection>
      </div>
      {confirmDialog}
    </BoPage>
  );
}
