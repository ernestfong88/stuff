import { ClipboardList, Search, Users } from 'lucide-react';
import { navigate } from '../../shell/router';
import { useMe, useVenue } from '../../shell/session';
import { useDiningOrders } from '../../store/dining';
import { useHeaderFit } from '../../shell/headerFit';
import { Button } from '../../ui';
import { MenuReferenceButton, PointsChip } from '../server/features';
import { HeaderMore } from '../server/HeaderMore';
import { inPlan, useRoomPlan } from '../../store/floorLayout';
import s from './ManagerHeader.module.css';

/** Left side of the manager header: the manager's own tables and points, as on the server tablet. */
export function ManagerNav({ onPoints }: { onPoints: () => void }) {
  const me = useMe();
  const [venue] = useVenue();
  const plan = useRoomPlan(venue);
  const orders = useDiningOrders();
  // The header folds to fit (see shell/headerFit): from level 1 the buttons keep their icons only.
  const narrow = useHeaderFit() >= 1;
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

/** Right side of the manager header: menu reference, residents and the server's shift review; a More menu when short of room. */
export function ManagerActions({ view, onResidents, onReview }: { view: string; onResidents: () => void; onReview: () => void }) {
  const fit = useHeaderFit();
  const narrow = fit >= 1;
  if (fit >= 3) {
    return (
      <HeaderMore
        pages={[
          { label: 'Residents', icon: <Users size={16} strokeWidth={2} />, active: view === 'residents', onClick: onResidents },
          { label: 'Shift Review', icon: <Search size={16} strokeWidth={2} />, active: view === 'review', onClick: onReview },
        ]}
      />
    );
  }
  return (
    <>
      <MenuReferenceButton short={narrow} className={s.navBtn} />
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
