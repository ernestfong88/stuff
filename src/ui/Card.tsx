import { forwardRef, type HTMLAttributes } from 'react';
import s from './Card.module.css';
import { cx } from './cx';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Inner padding: none, sm (12), md (16), lg (20). */
  pad?: 'none' | 'sm' | 'md' | 'lg';
  /** Sunken grey panel instead of a white card. */
  sunken?: boolean;
  /** Hover/press feedback for tappable cards (render as a button for real actions). */
  interactive?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { pad = 'md', sunken, interactive, className, ...rest },
  ref,
) {
  return <div ref={ref} className={cx(s.card, s[pad], sunken && s.sunken, interactive && s.interactive, className)} {...rest} />;
});
