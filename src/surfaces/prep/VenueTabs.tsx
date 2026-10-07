import { PRODUCTION_VENUES } from '../../store/production';
import { cx } from '../../ui';
import s from './VenueTabs.module.css';

/** Sequoia / Evergreen / The Bistro: which kitchen's plan is on screen. */
export function VenueTabs({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div className={s.tabs} role="group" aria-label="Venue">
      {PRODUCTION_VENUES.map((v) => (
        <button key={v.id} aria-pressed={v.id === value} className={cx(s.tab, v.id === value && s.on)} onClick={() => onChange(v.id)}>
          {v.name}
        </button>
      ))}
    </div>
  );
}
