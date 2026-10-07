import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { Search, X } from 'lucide-react';
import s from './Field.module.css';
import { cx } from './cx';

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  icon?: ReactNode;
  /** Large touch-size input. */
  large?: boolean;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, icon, large, className, id, ...rest },
  ref,
) {
  const input = (
    <span className={cx(s.control, large && s.large, error ? s.invalid : null, className)}>
      {icon && <span className={s.icon}>{icon}</span>}
      <input ref={ref} id={id} className={s.input} aria-invalid={!!error} {...rest} />
    </span>
  );
  if (!label && !hint && !error) return input;
  return (
    <label className={s.field} htmlFor={id}>
      {label && <span className={s.label}>{label}</span>}
      {input}
      {error ? <span className={s.error}>{error}</span> : hint && <span className={s.hint}>{hint}</span>}
    </label>
  );
});

export interface SearchFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  large?: boolean;
}

/** Search box with a magnifier and a clear button. */
export function SearchField({ value, onChange, large, className, placeholder = 'Search', ...rest }: SearchFieldProps) {
  return (
    <span className={cx(s.control, large && s.large, className)}>
      <span className={s.icon}>
        <Search size={16} strokeWidth={2} />
      </span>
      <input
        type="search"
        className={s.input}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-label={rest['aria-label'] ?? placeholder}
        {...rest}
      />
      {value && (
        <button className={s.clear} onClick={() => onChange('')} aria-label="Clear search">
          <X size={14} strokeWidth={2.4} />
        </button>
      )}
    </span>
  );
}

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  hint?: ReactNode;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea({ label, hint, className, id, ...rest }, ref) {
  const area = <textarea ref={ref} id={id} className={cx(s.control, s.textarea, className)} {...rest} />;
  if (!label && !hint) return area;
  return (
    <label className={s.field} htmlFor={id}>
      {label && <span className={s.label}>{label}</span>}
      {area}
      {hint && <span className={s.hint}>{hint}</span>}
    </label>
  );
});
