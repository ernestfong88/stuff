import { now } from '../../../lib/clock';
import { BoSelect } from './controls';
import { DATE_PRESETS, withPreset, type DatePreset, type DateRange } from './dateRange';
import s from './DateRangeFilter.module.css';

/** Date range for a back office list: a preset, or Custom with from and to days. */
export function DateRangeFilter({
  value,
  onChange,
  label = 'Date range',
}: {
  value: DateRange;
  onChange: (next: DateRange) => void;
  label?: string;
}) {
  return (
    <span className={s.range} role="group" aria-label={label}>
      <BoSelect value={value.preset} onChange={(e) => onChange(withPreset(value, e.target.value as DatePreset, now()))} aria-label={label}>
        {DATE_PRESETS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </BoSelect>
      {value.preset === 'custom' && (
        <>
          <input
            type="date"
            className={s.day}
            aria-label="From"
            value={value.from ?? ''}
            max={value.to || undefined}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
          />
          <span className={s.to}>to</span>
          <input
            type="date"
            className={s.day}
            aria-label="To"
            value={value.to ?? ''}
            min={value.from || undefined}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
          />
        </>
      )}
    </span>
  );
}
