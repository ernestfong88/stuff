import { MapPin, Truck } from 'lucide-react';
import { minuteLabel, rangeLabel, roomTag } from '../../pud/service/windows';
import { kioskPlace } from '../model/order';
import { nextTimes, type TimeChoice } from '../model/times';
import { KButton } from '../ui/KButton';
import { MoreButton, Panel, Question, TileGrid } from '../ui/Layout';
import type { KioskFlow } from '../useKioskFlow';
import s from './TimeStep.module.css';

/**
 * When to bring it or pick it up: the next few open ranges first, with
 * "Other times" for the rest. Full ranges show greyed out on the full list.
 */
export function TimeStep({ flow, choices }: { flow: KioskFlow; choices: TimeChoice[] }) {
  const { s: st } = flow;
  const delivery = st.type === 'delivery';
  const next = nextTimes(choices, st.win);
  const open = choices.filter((c) => !c.room.full);
  const short = !st.more && open.length > next.length;
  const shown = short ? next : choices;
  const anyFull = choices.some((c) => c.room.full);
  const title = st.more ? 'All times' : delivery ? 'When should we bring it?' : 'When will you pick it up?';
  const sub = st.filled
    ? 'That time just filled up. Please pick another.'
    : short
      ? 'The next open times. Each is a 15 minute window.'
      : `Each time is a 15 minute window.${anyFull ? ' Grey times are full.' : ''}`;
  const last = choices[choices.length - 1];
  return (
    <div>
      <Question title={title} sub={sub} />
      <Panel className={s.place}>
        {delivery ? <Truck className={s.placeIcon} strokeWidth={2.2} aria-hidden /> : <MapPin className={s.placeIcon} strokeWidth={2.2} aria-hidden />}
        {kioskPlace(st.type, st.resident)}
        {delivery ? '. Times may vary.' : ''}
      </Panel>
      <TileGrid min={short ? 380 : 300} gap={16}>
        {shown.map(({ slot, room }) => {
          const on = st.win === slot.start && !room.full;
          const tag = roomTag(room);
          return (
            <KButton
              key={slot.start}
              column
              look={room.full ? 'off' : on ? 'selected' : 'secondary'}
              className={short ? s.timeBig : s.time}
              onClick={() => flow.advance({ win: slot.start, filled: false })}
            >
              <span>{rangeLabel(slot.start)}</span>
              {tag && <span className={s.tag}>{tag}</span>}
            </KButton>
          );
        })}
      </TileGrid>
      {short && last && (
        <div className={s.moreRow}>
          <MoreButton label={`Other times, until ${minuteLabel(last.slot.start + 15)}`} onClick={() => flow.put({ more: 'times' })} />
        </div>
      )}
    </div>
  );
}
