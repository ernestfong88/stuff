import { ClipboardList, Search, Users } from 'lucide-react';
import { navigate } from '../../shell/router';
import { useMe, useVenue } from '../../shell/session';
import { useDining } from '../../store/dining';
import { Button, useViewportWidth } from '../../ui';
import { MenuReferenceButton, PointsChip } from '../server/features';
import { inPlan, useRoomPlan } from '../../store/floorLayout';
import s from './ManagerHeader.module.css';

/** Below this width the header buttons drop their words and keep their icons. */
const NARROW = 1100;

/** Left side of the manager header: the manager's own tables and points, as on the server tablet. */
export function ManagerNav({ onPoints }: { onPoints: () => void }) {
  const me = useMe();
  const [venue] = useVenue();
  const plan = useRoomPlan(venue);
  const { orders } = useDining();
  const narrow = useViewportWidth() < NARROW;
  const mine = orders.filter((o) => !o.queueType && o.server === me.initials && inPlan(o, plan)).length;
  return (
    <>
      <Button
        className={s.navBtn}
        icon={<ClipboardList size={16} strokeWidth={2} />}
        onClick={() => navigate('server', ['mine'])}
        title="My tables, on the server screen"
        aria-label={`My tables, ${mine} open`}
      >
        {!narrow && 'My tables'}
        <span className={s.count}>{mine}</span>
      </Button>
      <PointsChip short={narrow} onOpen={onPoints} />
    </>
  );
}

/** Right side of the manager header: menu reference, residents and the server's shift review. */
export function ManagerActions({ view, onResidents, onReview }: { view: string; onResidents: () => void; onReview: () => void }) {
  const narrow = useViewportWidth() < NARROW;
  return (
    <>
      <MenuReferenceButton short={narrow} />
      <Button
        className={s.navBtn}
        icon={<Users size={16} strokeWidth={2} />}
        onClick={onResidents}
        active={view === 'residents'}
        title="Residents"
        aria-label={narrow ? 'Residents' : undefined}
      >
        {!narrow && 'Residents'}
      </Button>
      <Button
        className={s.navBtn}
        icon={<Search size={16} strokeWidth={2} />}
        onClick={onReview}
        active={view === 'review'}
        title="Shift Review"
        aria-label={narrow ? 'Shift Review' : undefined}
      >
        {!narrow && 'Shift Review'}
      </Button>
    </>
  );
}
