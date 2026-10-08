import { rooms } from '../../../../data';
import { venueFee } from '../../../../domain/billing';
import { updateConfig, useConfig } from '../../../../store/config';
import { BoPage, BoRow, BoSection, NumberBox } from '../../kit';
import type { BoPageProps } from '../../nav';
import { CorkageSettings } from './CorkageSettings';
import { SickWaiverSettings } from './SickWaiverSettings';
import s from './fees.module.css';

/** Highest fee a box takes, so a slip of the keyboard can't bill $700. */
export const MAX_FEE = 50;

/** A fee typed in a box: a whole-cent amount from $0 to MAX_FEE, else nothing (the box reverts). */
export function cleanFee(v: number | null | undefined): number | null {
  if (v == null || !Number.isFinite(v) || v < 0 || v > MAX_FEE) return null;
  return Math.round(v * 100) / 100;
}

/**
 * Delivery and pick up fees per venue: the one fee close & charge, the
 * kiosk, Charge Approval and Order History use. Sick waivers below.
 */
export default function DeliveryFeesTab(_props: Partial<BoPageProps>) {
  const cfg = useConfig();
  const set = (room: string, key: 'delivery' | 'pickup', v: number | null) => {
    const amt = cleanFee(v);
    if (amt == null) return;
    updateConfig((c) => ({ fees: { ...c.fees, [room]: { ...venueFee(room, c), [key]: amt } } }));
  };
  return (
    <BoPage title="Delivery fees">
      <BoSection
        title="Fee per venue"
        sub="Charged on seat 1 of every delivery or pick up check when it closes. Servers, the kiosk and Order History all use this fee. Hospice and sick waivers take it off."
      >
        {Object.entries(rooms).map(([key, room]) => {
          const f = venueFee(key, cfg);
          return (
            <BoRow key={key} label={room.name} hint={`Delivery ${f.delivery > 0 ? `$${f.delivery.toFixed(2)}` : 'free'} · pick up ${f.pickup > 0 ? `$${f.pickup.toFixed(2)}` : 'free'}`}>
              <span className={s.cork}>
                <span className={s.unit}>Delivery $</span>
                <NumberBox
                  value={f.delivery}
                  min={0}
                  max={MAX_FEE}
                  step={0.5}
                  aria-label={`Delivery fee at ${room.name}`}
                  onChange={(v) => set(key, 'delivery', v)}
                />
                <span className={s.unit}>Pick up $</span>
                <NumberBox value={f.pickup} min={0} max={MAX_FEE} step={0.5} aria-label={`Pick up fee at ${room.name}`} onChange={(v) => set(key, 'pickup', v)} />
              </span>
            </BoRow>
          );
        })}
      </BoSection>
      <SickWaiverSettings />
    </BoPage>
  );
}

/** Corkage: the per-bottle fee for wine a resident brings in (a tab of Meal Plans). */
export function CorkageTab() {
  return (
    <BoPage title="Corkage">
      <CorkageSettings />
    </BoPage>
  );
}
