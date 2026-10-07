import { useState } from 'react';
import { Check } from 'lucide-react';
import type { Broadcast } from '../../../../domain/types';
import { formatTime } from '../../../../lib/format';
import { ackNotice, ackedAt, liveNotices, pastNotices, unseenNotices, useNotices } from '../../../../store/notices';
import { Button, Sheet, Tabs, cx, useNow } from '../../../../ui';
import s from './NoticesSheet.module.css';

export type NoticesTab = 'new' | 'past';

const shortDate = (t: number) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/**
 * Notices from the office. Each one is acknowledged with Got it so the
 * office can see who has read it; what a server acknowledged stays under
 * Past notices.
 */
export function NoticesSheet({ who, open, onClose, initialTab = 'new' }: { who: string; open: boolean; onClose: () => void; initialTab?: NoticesTab }) {
  const state = useNotices();
  const t = useNow(30_000);
  const [tab, setTab] = useState<NoticesTab>(initialTab);
  // Notices acknowledged while the sheet is open stay in place, marked Seen.
  const [openedAt] = useState(t);
  const unseen = unseenNotices(state, who);
  const past = pastNotices(state, who);
  const shown: Broadcast[] =
    tab === 'past' ? past : liveNotices(state, t).filter((b) => !ackedAt(state, b.id, who) || ackedAt(state, b.id, who)! >= openedAt);

  const gotAll = () => {
    unseen.forEach((b) => ackNotice(b.id, who));
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      side="bottom"
      className={s.sheet}
      title={tab === 'past' ? 'Past notices' : 'Notices'}
      subtitle={
        tab === 'past'
          ? 'Notices you marked done, newest first.'
          : unseen.length
            ? 'Tap Got it on each one so the office knows you have seen it. Once you have, it moves to Past notices.'
            : 'All done. You can find these again in Past notices.'
      }
      footer={
        tab === 'new' && unseen.length ? (
          <Button variant="primary" size="lg" block onClick={gotAll}>
            {unseen.length > 1 ? `Got all ${unseen.length}` : 'Got it'}
          </Button>
        ) : (
          <Button variant="secondary" size="lg" block onClick={onClose}>
            {tab === 'past' ? 'Close' : 'Done'}
          </Button>
        )
      }
    >
      <Tabs
        className={s.tabs}
        variant="segmented"
        value={tab}
        onChange={setTab}
        aria-label="Which notices"
        options={[
          { id: 'new', label: 'Current', count: unseen.length || undefined, countTone: 'danger' },
          { id: 'past', label: 'Past notices', count: past.length },
        ]}
      />
      {!shown.length && (
        <div className={s.empty}>
          {tab === 'past' ? 'Nothing here yet. Notices land here once you tap Got it.' : 'No notices from the office right now.'}
        </div>
      )}
      <ul className={s.list}>
        {shown.map((b) => {
          const at = ackedAt(state, b.id, who);
          const expired = b.endDt < t;
          return (
            <li key={b.id} className={cx(s.notice, !at && s.unseen)}>
              <div className={s.text}>
                {b.scope === 'HO' && <div className={s.scope}>Home Office · all communities</div>}
                <div className={s.message}>{b.message}</div>
                <div className={s.meta}>
                  {at
                    ? (tab === 'past' ? `Marked done ${shortDate(at)} at ` : 'You acknowledged this at ') +
                      formatTime(at) +
                      (tab === 'past' && expired ? ' · no longer posted' : '')
                    : `Posted ${shortDate(b.startDt)}`}
                </div>
              </div>
              {at ? (
                <span className={s.seen}>
                  <Check size={15} strokeWidth={2.6} aria-hidden /> Seen
                </span>
              ) : (
                <Button variant="primary" onClick={() => ackNotice(b.id, who)}>
                  Got it
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}

