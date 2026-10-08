import type { CSSProperties } from 'react';
import { dishPhoto } from '../../../../data/photos';
import { cx } from '../../../../ui';
import s from './DishPhoto.module.css';

/**
 * A dish's photo, matched by name, or a plain plate when there is none, so
 * there is never a broken image.
 */
export function DishPhoto({
  name,
  wide,
  dark,
  className,
  style,
  glyph = 40,
}: {
  name: string;
  /** Prefer the wide shot (banners, special cards). */
  wide?: boolean;
  dark?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Plate size when there is no photo. */
  glyph?: number;
}) {
  const src = dishPhoto(name, wide);
  if (src) return <img className={cx(s.photo, dark && s.dark, className)} style={style} src={src} alt={name} draggable={false} />;
  return (
    <span className={cx(s.photo, s.empty, dark && s.dark, className)} style={style} role="img" aria-label={`${name}, no photo yet`}>
      <svg width={glyph} height={glyph} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
        <circle cx={12} cy={12} r={9.5} />
        <circle cx={12} cy={12} r={5.5} />
      </svg>
    </span>
  );
}
