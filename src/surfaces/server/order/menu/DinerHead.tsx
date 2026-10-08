import { dinerName, dinerPerson } from '../../../../domain/orders';
import type { Diner, Resident } from '../../../../domain/types';
import { isOnHospice } from '../../../../domain/waivers';
import { residentPlan } from '../../../backoffice/kit/residentRecords';
import { today } from '../../../../lib/clock';
import { useConfig } from '../../../../store/config';
import { residentPref, useResidentPrefs } from '../../../../store/residentPrefs';
import { Avatar, Chip } from '../../../../ui';
import { GoodToKnow } from '../../features';
import { dinerFace } from '../diners/DinerCard';
import s from './DinerHead.module.css';

/**
 * __kPlanTill: "12 meals till 11/1". The plans carry no reset date, only a
 * per month or per day allowance, so a monthly plan resets on the 1st and a
 * daily plan tomorrow.
 */
export function planTill(r: Resident): string | null {
  const plan = residentPlan(r.id);
  if (!plan || !plan.amt) return null;
  const left = Math.max(0, plan.amt - r.consumed);
  const d = today();
  if (plan.type === 'Daily') d.setDate(d.getDate() + 1);
  else d.setMonth(d.getMonth() + 1, 1);
  return `${left} ${left === 1 ? 'meal' : 'meals'} till ${d.getMonth() + 1}/${d.getDate()}`;
}

/** Who is ordering, above the menu: a resident gets their photo, plan, hospice and what they like. */
export function DinerHead({ diner, onProfile }: { diner: Diner; onProfile: (residentId: string) => void }) {
  const prefs = useResidentPrefs();
  const cfg = useConfig();
  const person = dinerPerson(diner);
  if (diner.kind === 'resident' && !diner.isGuest && person) {
    const r = person as Resident;
    const pref = residentPref(prefs, r.id);
    const till = planTill(r);
    return (
      <div className={`${s.head} fade-in`}>
        <button className={s.photo} onClick={() => onProfile(r.id)} aria-label={`${r.name}'s profile`}>
          <Avatar person={r} size={112} className={s.avatar} />
        </button>
        <div className={s.info}>
          <div className={s.nameRow}>
            <button className={s.name} title={r.name} onClick={() => onProfile(r.id)}>
              {r.name}
            </button>
            {till && <span className={s.till}>{till}</span>}
          </div>
          {isOnHospice(r.id, cfg) && (
            <div>
              <Chip size="xs" tone="plum">
                ON HOSPICE
              </Chip>
            </div>
          )}
          {pref ? (
            <div className={s.pref}>
              <div className={s.prefLabel}>Likes and dislikes</div>
              <div className={s.prefText}>{pref}</div>
            </div>
          ) : (
            <GoodToKnow resident={r} />
          )}
        </div>
      </div>
    );
  }
  const host = person?.name.split(' ')[0] ?? '';
  const sub = diner.isGuest
    ? `${diner.guestRel || 'Guest'} of ${host} · pays à la carte`
    : diner.kind === 'resident'
      ? (person as Resident | undefined)?.fav || `Apt ${(person as Resident | undefined)?.apt ?? ''}`
      : 'Associate · pays à la carte';
  return (
    <div className={s.small}>
      <Avatar person={dinerFace(diner, person)} size={34} />
      <div className={s.smallText}>
        <div className={s.smallName}>{dinerName(diner)}</div>
        <div className={s.smallSub}>{sub}</div>
      </div>
    </div>
  );
}
