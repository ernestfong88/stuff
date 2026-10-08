import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import s from './Button.module.css';
import { cx } from './cx';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'dark'
  | 'success'
  | 'warning'
  | 'danger'
  | 'soft'
  | 'softSuccess'
  | 'softDanger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Icon before the label. */
  icon?: ReactNode;
  /** Icon after the label. */
  iconRight?: ReactNode;
  /** Stretch to the container width. */
  block?: boolean;
  /** Square button that only holds an icon; pass aria-label. */
  iconOnly?: boolean;
  /** Visually "on" (for toggle-style nav buttons). */
  active?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, iconRight, block, iconOnly, active, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(s.btn, s[variant], s[size], block && s.block, iconOnly && s.iconOnly, active && s.active, className)}
      aria-pressed={active === undefined ? undefined : active}
      {...rest}
    >
      {icon && <span className={s.icon}>{icon}</span>}
      {children != null && children !== false && <span className={s.label}>{children}</span>}
      {iconRight && <span className={s.icon}>{iconRight}</span>}
    </button>
  );
});
