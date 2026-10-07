/**
 * Small editors for service settings, used by the Back Office pages that set
 * how the floor screens behave (Alerts & Timing, Service Flow, Shift
 * Metrics). Each writes straight to the shared settings, so the dining
 * screens change while the page is still open.
 */
import { useState, type ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import { resetSettingsSection, setSetting, useSetting } from '../../../store/serviceConfig';
import { Button, cx, toast } from '../../../ui';
import { NumberBox } from '.';
import s from './SettingControls.module.css';

interface NumberProps {
  /** Settings path, e.g. "t.passLate" or "gap.send.0". */
  path: string;
  label: string;
  unit?: string;
  min?: number;
  step?: number;
  /** A blank box means the setting is off (stored as 0). */
  off?: boolean;
  width?: number;
  /** Shown while the box is blank and the setting has no value. */
  placeholder?: string;
  /** Store the typed number differently (e.g. percent to a fraction). */
  toStored?: (v: number) => number;
  fromStored?: (v: number) => number;
  /** Clearing the box removes the setting instead of turning it off. */
  clearRemoves?: boolean;
}

/**
 * __KBONum: a number setting. While typing, the box keeps what was typed
 * (even a blank or a half number); the setting only changes to valid values.
 */
export function SettingNumber({ path, label, unit = 'min', min = 0, step = 1, off, width = 72, placeholder, toStored, fromStored, clearRemoves }: NumberProps) {
  const stored = useSetting<number | string | null | undefined>(path);
  const [draft, setDraft] = useState<number | null | undefined>(undefined);
  const value = stored == null || stored === '' ? null : Number(stored);
  const shown = draft !== undefined ? draft : off && !value ? null : value == null ? null : fromStored ? fromStored(value) : value;
  return (
    <NumberBox
      value={shown}
      unit={unit}
      min={min}
      step={step}
      width={width}
      placeholder={placeholder ?? (off ? 'Off' : '')}
      aria-label={label}
      onChange={(v) => {
        setDraft(v);
        if (v == null) {
          if (clearRemoves) setSetting(path, undefined);
          else if (off) setSetting(path, 0);
        } else if (v >= min) setSetting(path, toStored ? toStored(v) : v);
      }}
      onBlur={() => setDraft(undefined)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
    />
  );
}

/** Coloured square with a word: "Red after", "Amber over". */
export function Swatch({ tone, children }: { tone: 'red' | 'amber'; children: string }) {
  return (
    <span className={s.swatch}>
      <span className={cx(s.square, s[tone])} />
      {children}
    </span>
  );
}

/** Back to the defaults for some sections, with a short confirmation. */
export function ResetButton({ onReset, sections = [], message }: { onReset?: () => void; sections?: string[]; message: string }) {
  return (
    <Button
      icon={<RotateCcw size={14} />}
      onClick={() => {
        sections.forEach(resetSettingsSection);
        onReset?.();
        toast(message, { tone: 'success' });
      }}
    >
      Reset to defaults
    </Button>
  );
}

/** Pill buttons to pick several (e.g. the meals a setting applies to). */
export function PickMany<T extends string>({ options, value, onChange, label }: { options: T[]; value: T[]; onChange: (v: T[]) => void; label: string }) {
  return (
    <div className={s.pills} role="group" aria-label={label}>
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button key={o} className={cx(s.pill, on && s.pillOn)} aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}>
            {o}
          </button>
        );
      })}
    </div>
  );
}

/** A setting's name with a short note under it, for table rows. */
export function NameAndNote({ name, note }: { name: string; note: string }) {
  return (
    <>
      <div className={s.name}>{name}</div>
      <div className={s.note}>{note}</div>
    </>
  );
}

/** Quiet text in a table cell ("Not scored"). */
export function Muted({ children }: { children: string }) {
  return <span className={s.muted}>{children}</span>;
}

/** A plain select that matches the back office inputs. */
export function SettingSelect<T extends string>({ value, options, onChange, label }: { value: T; options: ReadonlyArray<{ id: T; label: string }>; onChange: (v: T) => void; label: string }) {
  return (
    <select
      className={s.select}
      aria-label={label}
      value={value}
      onChange={(e) => {
        const picked = options.find((o) => o.id === e.target.value);
        if (picked) onChange(picked.id);
      }}
    >
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** A row of small labelled fields that wraps ("Sequoia [2] min  Bistro [2] min"). */
export function InlineFields({ children }: { children: ReactNode }) {
  return <div className={s.fields}>{children}</div>;
}

export function InlineField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className={s.field}>
      {label}
      {children}
    </label>
  );
}
