import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { cx } from '../../../ui';
import s from './KButton.module.css';

export type KButtonLook = 'primary' | 'secondary' | 'selected' | 'off';

export interface KButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary: the main way on. secondary: other answers. selected: the current answer. off: can't be picked. */
  look?: KButtonLook;
  icon?: ReactNode;
  /** Stack icon and text (tiles). */
  column?: boolean;
  /** Left-aligned content (list rows). */
  start?: boolean;
  block?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

/** The kiosk's big, high-contrast button. */
export function KButton({ look = 'secondary', icon, column, start, block, className, children, type = 'button', disabled, ref, ...rest }: KButtonProps) {
  const off = look === 'off' || disabled;
  return (
    <button
      ref={ref}
      type={type}
      className={cx(s.btn, s[off ? 'off' : look], column && s.column, start && s.start, block && s.block, className)}
      disabled={off}
      aria-pressed={look === 'selected' ? true : undefined}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
