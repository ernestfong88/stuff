import { flag } from '../../../../domain/config';
import { hospiceStatus } from '../../../../domain/waivers';
import { formatTime } from '../../../../lib/format';
import { setHospice, useConfig } from '../../../../store/config';
import { Chip, TextArea, Toggle, toast } from '../../../../ui';
import { BoRow, BoSection } from '../../kit';
import { BACK_OFFICE_USER } from '../../seed/associates';
import s from './residents.module.css';

const dateText = (iso: string) => (iso ? new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');
const whenText = (t: number) => `${new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${formatTime(t)}`;

/**
 * Hospice: while a resident is on hospice their delivery fees are waived
 * automatically with no manager PIN, it never uses a sick waiver, and staff
 * can switch it off for a single order. Every switch is logged.
 */
export function HospiceCard({ rid, name }: { rid: string; name: string }) {
  const cfg = useConfig();
  const h = hospiceStatus(rid, cfg) ?? { on: false, since: '', note: '', log: [] };
  const first = name.split(' ')[0];
  const meals = flag(cfg, 'hospiceAuto');
  const fees = flag(cfg, 'freeDeliveryComp');
  const does = [meals && 'meals are comped at close', fees && 'delivery fees are waived'].filter(Boolean).join(' and ');
  const set = (patch: Parameters<typeof setHospice>[1], message?: string) => {
    setHospice(rid, patch, BACK_OFFICE_USER.name);
    if (message) toast(message, { tone: 'success' });
  };
  return (
    <BoSection
      title="Hospice"
      actions={h.on ? <Chip tone="plum" size="xs">On hospice</Chip> : undefined}
      sub={
        does
          ? `While ${first} is on hospice, ${does}, with no manager PIN. It never uses a sick waiver, and staff can switch it off for a single order.`
          : `Both hospice comps are off in Service Flow, so a manager comps ${first}'s meals and fees with their PIN.`
      }
    >
      <BoRow label="On hospice" hint={h.on ? `Since ${dateText(h.since)}` : 'Off: meals and delivery fees are charged as usual'}>
        <Toggle
          checked={h.on}
          onChange={(on) => set({ on }, on ? `${first} is on hospice${does ? `: ${does} from now on` : ''}.` : `${first} is no longer on hospice.`)}
          label={<span className="sr-only">On hospice, {name}</span>}
        />
      </BoRow>
      {h.on && (
        <>
          <BoRow label="Start date">
            <input type="date" className={s.date} aria-label="Hospice start date" value={h.since} onChange={(e) => set({ since: e.target.value })} />
          </BoRow>
          <div className={s.hospNote}>
            <TextArea label="Note (optional)" hint={`Staff see this on ${first}'s deliveries.`} rows={2} value={h.note} onChange={(e) => set({ note: e.target.value })} />
          </div>
        </>
      )}
      {does && !fees && <p className={s.warnText}>The hospice delivery fee waiver is off in Service Flow, so a manager waives the fee with their PIN.</p>}
      {does && !meals && <p className={s.warnText}>Hospice meal comps are off in Service Flow, so a manager comps meals with their PIN.</p>}
      {h.log.length > 0 && (
        <ul className={s.audit}>
          {h.log.slice(0, 4).map((e, i) => (
            <li key={i}>
              {e.on ? 'Turned on' : 'Turned off'} by {e.by} · {whenText(e.at)}
            </li>
          ))}
        </ul>
      )}
    </BoSection>
  );
}
