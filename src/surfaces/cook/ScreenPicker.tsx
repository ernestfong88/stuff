import { useId } from 'react';
import { setDeviceScreen, type ScreenOption } from '../kitchen/venueSettings';
import s from './ScreenPicker.module.css';

/** THIS SCREEN: which cook screen this device is. Saved on the device. */
export function ScreenPicker({ value, options }: { value: string; options: ScreenOption[] }) {
  const id = useId();
  return (
    <span className={s.picker}>
      <label htmlFor={id} className={s.label}>
        This screen
      </label>
      <select id={id} className={s.select} value={value} onChange={(e) => setDeviceScreen(e.target.value)}>
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.roomName} · {o.name}
          </option>
        ))}
      </select>
    </span>
  );
}
