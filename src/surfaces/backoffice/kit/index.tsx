/**
 * Building blocks for back office pages, so the 34 pages share one layout:
 *
 *   <BoPage title sub actions>
 *     <BoSection title sub actions>
 *       <BoRow label hint> control </BoRow>
 *     </BoSection>
 *     <BoTable columns rows />
 *   </BoPage>
 */
import type { CSSProperties, InputHTMLAttributes, ReactNode } from 'react';
import { cx } from '../../../ui';
import s from './kit.module.css';

export function BoPage({ title, sub, actions, children }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return (
    <div className={s.page}>
      <header className={s.pageHead}>
        <div className={s.pageTitles}>
          <h1 className={s.pageTitle}>{title}</h1>
          {sub && <p className={s.pageSub}>{sub}</p>}
        </div>
        {actions && <div className={s.pageActions}>{actions}</div>}
      </header>
      {children}
    </div>
  );
}

export function BoSection({ title, sub, actions, children, flush, className }: { title?: ReactNode; sub?: ReactNode; actions?: ReactNode; children?: ReactNode; flush?: boolean; className?: string }) {
  return (
    <section className={cx(s.section, flush && s.flush, className)}>
      {(title || actions) && (
        <header className={s.sectionHead}>
          <div className={s.sectionTitles}>
            {title && <h2 className={s.sectionTitle}>{title}</h2>}
            {sub && <p className={s.sectionSub}>{sub}</p>}
          </div>
          {actions && <div className={s.sectionActions}>{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

/** A setting: label and hint on the left, its control on the right. */
export function BoRow({ label, hint, children, align = 'center' }: { label: ReactNode; hint?: ReactNode; children?: ReactNode; align?: 'center' | 'start' }) {
  return (
    <div className={cx(s.row, align === 'start' && s.rowStart)}>
      <div className={s.rowText}>
        <div className={s.rowLabel}>{label}</div>
        {hint && <div className={s.rowHint}>{hint}</div>}
      </div>
      {children != null && <div className={s.rowControl}>{children}</div>}
    </div>
  );
}

export interface BoColumn<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  width?: number | string;
}

/** Plain data table with sticky header. */
export function BoTable<T>({ columns, rows, rowKey, empty, onRowClick, dense }: { columns: Array<BoColumn<T>>; rows: T[]; rowKey: (row: T) => string; empty?: ReactNode; onRowClick?: (row: T) => void; dense?: boolean }) {
  return (
    <div className={s.tableWrap}>
      <table className={cx(s.table, dense && s.dense)}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={{ textAlign: c.align, width: c.width }}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className={s.emptyCell}>
                {empty ?? 'Nothing here yet.'}
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={rowKey(r)} onClick={onRowClick ? () => onRowClick(r) : undefined} className={onRowClick ? s.clickRow : undefined}>
                {columns.map((c) => (
                  <td key={c.key} style={{ textAlign: c.align }}>
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Small number box with a unit ("5 min"); empty means off/unset. */
export function NumberBox({ value, onChange, unit, placeholder, width = 64, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & { value: number | '' | null | undefined; onChange: (v: number | null) => void; unit?: string; width?: number }) {
  return (
    <span className={s.numberBox}>
      <input
        type="number"
        inputMode="decimal"
        className={s.number}
        style={{ width } as CSSProperties}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        {...rest}
      />
      {unit && <span className={s.unit}>{unit}</span>}
    </span>
  );
}

/** Coloured callout ("Top action ...", warnings, explanations). */
export function BoCallout({ tone = 'info', title, children }: { tone?: 'info' | 'warning' | 'danger' | 'success'; title?: ReactNode; children?: ReactNode }) {
  return (
    <div className={cx(s.callout, s[`callout_${tone}`])}>
      {title && <div className={s.calloutTitle}>{title}</div>}
      {children}
    </div>
  );
}

/** Grid of cards that wraps responsively. */
export function BoGrid({ min = 280, gap = 16, children }: { min?: number; gap?: number; children: ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(min(${min}px, 100%), 1fr))`, gap }}>{children}</div>;
}
