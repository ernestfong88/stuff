import { PRODUCTION_VENUES } from '../../store/production';
import { HeaderButton } from '../kitchen/KitchenShell';
import s from './VenueTabs.module.css';

/** Sequoia / Evergreen / The Bistro: which kitchen's plan is on screen, as kitchen header buttons. */
export function VenueTabs({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div className={s.tabs} role="group" aria-label="Venue">
      {PRODUCTION_VENUES.map((v) => (
        <HeaderButton key={v.id} on={v.id === value} aria-pressed={v.id === value} onClick={() => onChange(v.id)}>
          {v.name}
        </HeaderButton>
      ))}
    </div>
  );
}
