/**
 * Small form controls the menu pages share: a styled select, a money input,
 * a labelled field and a table frame whose header stays put while the rows
 * scroll.
 */
import { forwardRef, type CSSProperties, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { cx } from '../../../../ui';
import s from './controls.module.css';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'size'> {
  value: string;
  onChange: (value: string) => void;
  options?: SelectOption[];
  /** Option groups: [group label, options]. */
  groups?: Array<[string, SelectOption[]]>;
  /** First option, with an empty value ("Any protein"). */
  placeholder?: string;
  size?: 'sm' | 'md';
  /** Outline it when a filter value is chosen. */
  emphasize?: boolean;
}

export function Select({ value, onChange, options = [], groups, placeholder, size = 'md', emphasize, className, ...rest }: SelectProps) {
  const opt = (o: SelectOption) => (
    <option key={o.value} value={o.value} disabled={o.disabled}>
      {o.label}
    </option>
  );
  return (
    <span className={cx(s.selectWrap, s[size], emphasize && value && s.emphasize, className)}>
      <select className={s.select} value={value} onChange={(e) => onChange(e.target.value)} {...rest}>
        {placeholder != null && <option value="">{placeholder}</option>}
        {groups
          ? groups.map(([label, list]) =>
              label ? (
                <optgroup key={label} label={label}>
                  {list.map(opt)}
                </optgroup>
              ) : (
                list.map(opt)
              ),
            )
          : options.map(opt)}
      </select>
    </span>
  );
}

/** Dollar amount; empty means "not set" (shows the placeholder). */
export function MoneyInput({
  value,
  onChange,
  placeholder = '—',
  width = 88,
  className,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  width?: number;
}) {
  return (
    <span className={s.money} style={{ width } as CSSProperties}>
      <span className={s.moneySign} aria-hidden>
        $
      </span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step={0.5}
        className={cx(s.moneyInput, className)}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value === '' ? null : Math.max(0, Number(e.target.value)))}
        {...rest}
      />
    </span>
  );
}

/** Small uppercase label above a control, with an optional hint under it. */
export function Field({
  label,
  hint,
  right,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx(s.field, className)}>
      <div className={s.fieldHead}>
        <span className={s.fieldLabel}>{label}</span>
        {right}
      </div>
      {children}
      {hint && <span className={s.fieldHint}>{hint}</span>}
    </div>
  );
}

/** Frame for a long table: the header sticks and only the table scrolls sideways. */
export function TableFrame({ children, maxHeight, className }: { children: ReactNode; maxHeight?: string; className?: string }) {
  return (
    <div className={cx(s.tableFrame, className)} style={maxHeight ? ({ maxHeight } as CSSProperties) : undefined}>
      {children}
    </div>
  );
}

export const tableClass = s.table;

/** Plain text (or number) input in the Back Office style. */
export const Input = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & { size?: 'sm' | 'md' }>(function Input(
  { size = 'md', className, ...rest },
  ref,
) {
  return <input ref={ref} className={cx(s.input, s[`input_${size}`], className)} {...rest} />;
});
