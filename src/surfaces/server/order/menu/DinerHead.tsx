import { Sparkles } from 'lucide-react';
import { mealPlans } from '../../../../data';
import { dinerName, dinerPerson } from '../../../../domain/orders';
import type { Diner, Resident } from '../../../../domain/types';
import { isOnHospice } from '../../../../domain/waivers';
import { today } from '../../../../lib/clock';
import { useConfig } from '../../../../store/config';
import { useNotes } from '../../../../store/notes';
import { residentPref, useResidentPrefs } from '../../../../store/residentPrefs';
import { Avatar, Chip } from '../../../../ui';
import { goodToKnow } from '../../seed';
import { dinerFace } from '../diners/DinerCard';
import s from './DinerHead.module.css';

/**
 * __kPlanTill: "12 meals till 11/1". The plans carry no reset date, only a
 * per month or per day allowance, so a monthly plan resets on the 1st and a
 * daily plan tomorrow.
 */
export function planTill(r: Resident): string | null {
  const plan = mealPlans[r.plan];
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
            <GoodToKnowCard resident={r} />
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

/** "Good to know": what servers noticed lately, the little things, and a question to open with. */
function GoodToKnowCard({ resident }: { resident: Resident }) {
  const notes = useNotes();
  const contact = resident.contacts?.[0];
  const base = goodToKnow[resident.id] ?? (contact ? { k: [], q: `How is your ${contact.rel.toLowerCase()} ${contact.name.split(' ')[0]} doing?` } : null);
  const key = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const seen = new Set<string>();
  const once = (t: string) => !seen.has(key(t)) && !!seen.add(key(t));
  const recent = notes
    .filter((n) => n.rid === resident.id && (n.kind === 'know' || n.kind === 'obs'))
    .sort((a, b) => b.at - a.at)
    .map((n) => n.text)
    .filter(once);
  if (!base && !recent.length) return null;
  const lines = [...recent, ...(base ? base.k.filter(once) : [])].slice(0, 3);
  return (
    <div className={s.know}>
      <div className={s.knowLabel}>
        <Sparkles size={12} aria-hidden /> Good to know
      </div>
      {lines.map((t, i) => (
        <div key={i} className={s.knowLine}>
          {i < recent.length && <span className={s.newTag}>New</span>}
          {t}
        </div>
      ))}
      {base?.q && <div className={s.question}>“{base.q}”</div>}
    </div>
  );
}
