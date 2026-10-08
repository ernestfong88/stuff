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
import { createContext, useContext, type CSSProperties, type InputHTMLAttributes, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Tabs, cx } from '../../../ui';
import s from './kit.module.css';

/**
 * Set by a page that shows other pages as its tabs (BoTabbedPage): their
 * BoPage drops its own title, since the tab already names it, and keeps its
 * description and buttons.
 */
const EmbeddedPage = createContext(false);

/** Show a page inside another page's tab, without its own title. */
export function BoEmbedded({ children }: { children: ReactNode }) {
  return <EmbeddedPage.Provider value={true}>{children}</EmbeddedPage.Provider>;
}

/** A back office page. `wide` lets a work surface (the menu builder) use the whole window instead of the shell's reading width. */
export function BoPage({
  title,
  sub,
  actions,
  wide,
  children,
}: {
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  wide?: boolean;
  children?: ReactNode;
}) {
  const embedded = useContext(EmbeddedPage);
  if (embedded)
    return (
      <div className={s.page} data-bo-wide={wide || undefined}>
        {(sub || actions) && (
          <header className={s.embedHead}>
            {sub && <p className={s.embedSub}>{sub}</p>}
            {actions && <div className={s.pageActions}>{actions}</div>}
          </header>
        )}
        {children}
      </div>
    );
  return (
    <div className={s.page} data-bo-wide={wide || undefined}>
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

export interface BoTab {
  id: string;
  label: ReactNode;
  count?: number;
  render: () => ReactNode;
}

/**
 * A page made of tabs, each one a former page of its own: one title, one row
 * of tabs, and the chosen tab below. The tab lives in the address,
 * #/backoffice/<page>/<tab>; the first tab has no segment, so it keeps
 * whatever comes after the page (a resident's id, its own sub-tab).
 */
export function BoTabbedPage({
  page,
  title,
  sub,
  tabs,
  current,
  onTab,
  actions,
}: {
  page: string;
  title: ReactNode;
  sub?: ReactNode;
  tabs: BoTab[];
  current: string;
  onTab: (id: string) => void;
  /** Buttons beside the title, for the whole page (each tab keeps its own). */
  actions?: ReactNode;
}) {
  const tab = tabs.find((t) => t.id === current) ?? tabs[0];
  return (
    <div className={s.page}>
      <header className={s.pageHead}>
        <div className={s.pageTitles}>
          <h1 className={s.pageTitle}>{title}</h1>
          {sub && <p className={s.pageSub}>{sub}</p>}
        </div>
        {actions && <div className={s.pageActions}>{actions}</div>}
      </header>
      <Tabs variant="underline" aria-label={`${typeof title === 'string' ? title : page} sections`} value={tab.id} onChange={onTab} options={tabs.map((t) => ({ id: t.id, label: t.label, count: t.count }))} />
      <EmbeddedPage.Provider value={true}>{tab.render()}</EmbeddedPage.Provider>
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
  /** Makes the header a sort button (with BoTable's sort / onSort). */
  sortable?: boolean;
}

export interface BoSort {
  key: string;
  /** 1 ascending, -1 descending. */
  dir: 1 | -1;
}

/** Next sort after clicking a column header: same column flips, a new one starts ascending. */
export function nextSort(cur: BoSort, key: string): BoSort {
  return { key, dir: cur.key === key ? (cur.dir === 1 ? -1 : 1) : 1 };
}

/** Plain data table with sticky header. Sorting is optional and controlled by the page. */
export function BoTable<T>({
  columns,
  rows,
  rowKey,
  empty,
  onRowClick,
  dense,
  sort,
  onSort,
  rowTone,
  caption,
}: {
  columns: Array<BoColumn<T>>;
  rows: T[];
  rowKey: (row: T) => string;
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
  dense?: boolean;
  sort?: BoSort;
  onSort?: (sort: BoSort) => void;
  /** Dim a row (voided, retired) or tint it. */
  rowTone?: (row: T) => 'muted' | 'danger' | undefined;
  /** Screen reader name of the table. */
  caption?: string;
}) {
  return (
    <div className={s.tableWrap}>
      <table className={cx(s.table, dense && s.dense)}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c) => {
              const on = sort?.key === c.key;
              return (
                <th key={c.key} style={{ textAlign: c.align, width: c.width }} aria-sort={on ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
                  {c.sortable && sort && onSort ? (
                    <button className={cx(s.sortBtn, on && s.sortOn)} onClick={() => onSort(nextSort(sort, c.key))}>
                      {c.header}
                      <ChevronDown size={12} className={cx(s.sortIcon, on && sort.dir === -1 && s.sortDesc)} aria-hidden />
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              );
            })}
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
              <tr key={rowKey(r)} onClick={onRowClick ? () => onRowClick(r) : undefined} className={cx(onRowClick && s.clickRow, rowTone && s[`tone_${rowTone(r) ?? ''}`])}>
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
/** A typed number held to the box's max (min is left to the page, so typing "15" into a min-5 box still works). */
export function capAtMax(v: number, max: number | string | undefined): number {
  const m = max == null || max === '' ? NaN : Number(max);
  return Number.isFinite(m) && v > m ? m : v;
}

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
        {...rest}
        onChange={(e) => onChange(e.target.value === '' ? null : capAtMax(Number(e.target.value), rest.max))}
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

export { BoStatTile, BoStatRow, BoSelect, BoField, BoCaption, BoIconButton, BoFilterChip } from './controls';
export { BarChart, type BarChartProps, type BarDatum, type BarSegment } from './charts/BarChart';
export { DonutChart, type DonutChartProps, type DonutSlice } from './charts/DonutChart';
export { ShareBar, MeterBar, type SharePart } from './charts/ShareBar';
export { CHART } from './charts/palette';
export { useCommunity, setCommunity } from './community';
export { CrudTable, useCrudEditing, type CrudRow, type CrudColumn, type CrudEditing } from './CrudTable';
export { useBilling, setBillingList, billingStore, chargesToReview, amountToReview, type BillingState } from './billing';
export { useResidentRecords, updateResidentRecord, residentRecordsStore } from './residentRecords';
export { DateRangeFilter } from './DateRangeFilter';
export { ANY_DATE, inRange, isRangeSet, rangeBounds, type DatePreset, type DateRange } from './dateRange';
