import { rooms } from '../../../../data';
import { corkageSettings } from '../../../../domain/billing';
import { updateConfig, useConfig } from '../../../../store/config';
import { Toggle } from '../../../../ui';
import { BoRow, BoSection, NumberBox } from '../../kit';
import s from './fees.module.css';

/** Corkage per venue: on/off and the price a bottle. The dining check reads it from the shared config. */
export function CorkageSettings() {
  const cfg = useConfig();
  const set = (room: string, patch: { on?: boolean; amt?: number }) =>
    updateConfig((c) => ({ corkage: { ...c.corkage, [room]: { ...corkageSettings(room, c), ...patch } } }));
  return (
    <BoSection
      title="Corkage fee"
      sub="A check-level charge for wine a resident brings in. The server counts bottles when closing a dine-in check and the fee goes on seat 1. It is not a menu item."
    >
      {Object.entries(rooms).map(([key, room]) => {
        const c = corkageSettings(key, cfg);
        return (
          <BoRow key={key} label={room.name} hint={c.on ? `$${c.amt} a bottle` : "Off: servers don't see corkage here"}>
            {c.on && (
              <span className={s.cork}>
                <span className={s.unit}>$</span>
                <NumberBox
                  value={c.amt}
                  min={0}
                  step={1}
                  aria-label={`Corkage at ${room.name} per bottle`}
                  onChange={(v) => v != null && v >= 0 && set(key, { amt: v })}
                  unit="a bottle"
                />
              </span>
            )}
            <Toggle checked={c.on} onChange={(on) => set(key, { on })} label={<span className="sr-only">Corkage at {room.name}</span>} />
          </BoRow>
        );
      })}
    </BoSection>
  );
}
