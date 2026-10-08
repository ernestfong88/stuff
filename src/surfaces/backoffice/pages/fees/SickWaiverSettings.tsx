import { useMemo } from 'react';
import { getResident } from '../../../../data';
import { sickConfig, sickPeriodEnd, sickWaiversThisMonth } from '../../../../domain/waivers';
import { updateConfig, useConfig } from '../../../../store/config';
import { useDiningHistory, useDiningOrders } from '../../../../store/dining';
import { Chip, Toggle } from '../../../../ui';
import { BoCaption, BoRow, BoSection, NumberBox, useCommunity } from '../../kit';
import { waiverUseByResident, waiverUseText } from './sickWaivers';
import s from './fees.module.css';

const when = (t: number) => {
  const d = new Date(t);
  return `${d.getMonth() + 1}/${d.getDate()}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
};

/**
 * Sick delivery-fee waivers. A resident who is sick can have the delivery
 * fee waived with no manager PIN, up to a limit each meal plan period (the
 * calendar month for now). Past the limit a manager comps it with their PIN.
 */
export function SickWaiverSettings({ plain }: { plain?: boolean }) {
  const community = useCommunity();
  const cfg = useConfig();
  const orders = useDiningOrders();
  const history = useDiningHistory();
  const c = sickConfig(community, cfg);
  const till = sickPeriodEnd();
  const set = (patch: { on?: boolean; allow?: number }) => updateConfig((x) => ({ sick: { ...x.sick, [community]: { ...sickConfig(community, x), ...patch } } }));

  const waivers = useMemo(() => sickWaiversThisMonth([...orders, ...history], cfg), [orders, history, cfg]);
  const nameOf = (rid: string) => getResident(rid)?.name;
  const rows = waiverUseByResident(waivers, c.allow, nameOf);
  const recent = waivers
    .filter((w) => w.sickTray && nameOf(w.sickTray.rid))
    .sort((a, b) => (b.sickTray?.at ?? 0) - (a.sickTray?.at ?? 0))
    .slice(0, 8);

  return (
    <BoSection
      title={plain ? 'Sick waivers' : 'Sick delivery-fee waivers'}
      sub={plain ? undefined : `When a resident is sick, the server, the delivery desk or the resident at the kiosk can waive the delivery fee with no manager PIN, up to the limit. After that, each waiver needs a manager PIN, so the count is not abused. These settings are for ${community}.`}
    >
      <BoRow label="Sick fee waivers" hint={c.on ? 'On: “Sick, waive delivery fee” shows on resident deliveries.' : 'Off: the fee is charged. A manager can still comp it with their PIN.'}>
        <Toggle checked={c.on} onChange={(on) => set({ on })} label={<span className="sr-only">Sick fee waivers at {community}</span>} />
      </BoRow>
      {c.on && (
        <BoRow label="Limit per resident" hint={`Each meal plan period. For now that is the calendar month, so they start again on the 1st (this period runs until ${till}).`}>
          <NumberBox value={c.allow} min={0} step={1} aria-label="Sick fee waivers per resident" onChange={(v) => v != null && v >= 0 && set({ allow: Math.floor(v) })} unit="waivers" />
        </BoRow>
      )}
      {!plain && (
        <div className={s.block}>
          <BoCaption>Used until {till}</BoCaption>
          {rows.length ? (
            <ul className={s.list}>
              {rows.map((r) => {
                const res = getResident(r.rid);
                return (
                  <li key={r.rid} className={s.item}>
                    <span className={s.who}>
                      <span className={s.whoName}>{res?.name}</span>
                      <span className={s.whoSub}>Apt {res?.apt}</span>
                    </span>
                    <span className={s.count}>{waiverUseText(r, c.allow)}</span>
                    <Chip tone={r.allUsed ? 'warning' : 'success'}>{r.allUsed ? 'All used' : `${r.left} left`}</Chip>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className={s.empty}>No sick fee waivers yet this period.</p>
          )}
        </div>
      )}
      {!plain && recent.length > 0 && (
        <div className={s.block}>
          <BoCaption>Recent waivers</BoCaption>
          <ul className={s.list}>
            {recent.map((w) => {
              const tray = w.sickTray!;
              const meal = 'meal' in w && w.meal ? `${w.meal} delivery` : 'Delivery';
              const ref = 'ref' in w && typeof w.ref === 'string' ? w.ref : `order ${w.id.slice(-5).toUpperCase()}`;
              return (
                <li key={w.id} className={s.item}>
                  <span className={s.who}>
                    <span className={s.whoName}>{nameOf(tray.rid)}</span>
                    <span className={s.whoSub}>
                      {meal} · {ref}
                    </span>
                  </span>
                  <span className={s.by}>
                    by {tray.by || 'staff'} · {when(tray.at)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {!plain && <p className={s.note}>Residents with no waivers this period are not listed. Each waiver shows on the resident's charges as “Delivery fee waived (sick)”.</p>}
    </BoSection>
  );
}
