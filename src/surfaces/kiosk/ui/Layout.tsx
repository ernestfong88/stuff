import type { CSSProperties, ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cx } from '../../../ui';
import { KButton } from './KButton';
import s from './Layout.module.css';

/** The question at the top of a screen, with an optional line under it. */
export function Question({ title, sub, tight }: { title: ReactNode; sub?: ReactNode; tight?: boolean }) {
  return (
    <header className={cx(s.question, tight && s.tight)}>
      <h1 className={s.title}>{title}</h1>
      {sub && <p className={s.sub}>{sub}</p>}
    </header>
  );
}

/**
 * Answers in a grid that fits as many columns of at least `min` kiosk units
 * as there is room for: two on the portrait kiosk, more in landscape.
 */
export function TileGrid({ min, gap = 18, columns, children, className }: { min?: number; gap?: number; columns?: number; children: ReactNode; className?: string }) {
  const style = { '--min': min ?? 300, '--gap': gap, ...(columns ? { '--cols': columns } : {}) } as CSSProperties;
  return (
    <div className={cx(s.grid, columns && s.fixed, className)} style={style}>
      {children}
    </div>
  );
}

/** A row of actions that wrap on a narrow screen. */
export function Actions({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx(s.actions, className)}>{children}</div>;
}

/** White panel with the kiosk's soft outline. */
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx(s.panel, className)}>{children}</div>;
}

/** Small capitals above a group of answers ("COMMON CHANGES"). */
export function Caption({ children }: { children: ReactNode }) {
  return <h2 className={s.caption}>{children}</h2>;
}

/** Heading over a group of answers on a More list ("Vegetables"). */
export function GroupTitle({ children }: { children: ReactNode }) {
  return <h2 className={s.group}>{children}</h2>;
}

/** "More sides ›": opens the full list; shows the current pick when it's on that list. */
export function MoreButton({ label, current, onClick }: { label: string; current?: string | null; onClick: () => void }) {
  return (
    <KButton look={current ? 'selected' : 'secondary'} className={s.more} onClick={onClick}>
      <span className={s.moreText}>
        {label}
        {current && <span className={s.moreNow}>Now: {current}</span>}
      </span>
      <ChevronRight size="1.2em" strokeWidth={2.6} aria-hidden />
    </KButton>
  );
}
