/** Pieces the three dashboard cards and their details share. */
import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, Modal, cx } from '../../../../ui';
import { BarChart, BoCaption, CHART } from '../../kit';
import type { Insight, Tone } from './model/insight';
import { periodLabel, type RangeDays } from './model/periods';
import type { Driver } from './model/sentiment';
import { safeStorage } from '../../../../lib/storage';
import s from './dashboard.module.css';

/** "Resident meal sentiment" over the card with its Detail link. */
export function CardHead({ title, onDetail }: { title: string; onDetail: () => void }) {
  return (
    <header className={s.cardHead}>
      <h2 className={s.cardCap}>{title}</h2>
      <Button size="sm" variant="ghost" iconRight={<ChevronRight size={14} />} onClick={onDetail} aria-label={`${title}: detail`}>
        Detail
      </Button>
    </header>
  );
}

const OPEN_KEY = 'kisco_backoffice_dash_open_';

/** Open or closed, remembered per box on this device (storage can be blocked, so it falls back to `initial`). */
export function useRemembered(key: string, initial: boolean): [boolean, (v: boolean) => void] {
  const [v, setV] = useState(() => {
    const x = safeStorage.get(OPEN_KEY + key);
    return x == null ? initial : x === '1';
  });
  const set = (next: boolean) => {
    setV(next);
    safeStorage.set(OPEN_KEY + key, next ? '1' : '0');
  };
  return [v, set];
}

/** "Show details ⌄" under a card's summary. */
export function DetailsToggle({ open, onToggle, controls }: { open: boolean; onToggle: () => void; controls: string }) {
  return (
    <button type="button" className={s.detailsToggle} aria-expanded={open} aria-controls={controls} onClick={onToggle}>
      {open ? 'Hide details' : 'Show details'}
      <ChevronDown size={14} aria-hidden className={cx(s.chev, open && s.chevOpen)} />
    </button>
  );
}

/** The card's one recommended move. The first sentence is the action, the rest is why. */
export function TopAction({ tone, text, onClick }: { tone: Tone; text: string; onClick: () => void }) {
  const k = text.indexOf('. ');
  const act = k > 0 ? text.slice(0, k + 1) : text;
  const why = k > 0 ? text.slice(k + 2) : '';
  return (
    <button className={cx(s.topAction, s[`tone_${tone}`])} onClick={onClick} title="Open the detail">
      <span className={s.topCap}>Top action</span>
      <span className={s.topAct}>{act}</span>
      {why && <span className={s.topWhy}>{why}</span>}
    </button>
  );
}

/** "Start here": the headline, why, and the next step. */
export function StartHere({ insight }: { insight: Insight }) {
  return (
    <div className={cx(s.start, insight.tone === 'good' ? s.startGood : s.startBad)}>
      <div className={s.startCap}>Start here</div>
      <div className={s.startHead}>{insight.head}</div>
      {insight.body && <div className={s.startBody}>{insight.body}</div>}
      {insight.next && (
        <div className={s.startNext}>
          <b>Next step:</b> {insight.next}
        </div>
      )}
    </div>
  );
}

/** "What is driving it": a few lines, each a name, what it is and the number. */
export function Drivers({ rows }: { rows: Driver[] }) {
  if (!rows.length) return null;
  return (
    <div className={s.block}>
      <BoCaption>What is driving it</BoCaption>
      <ul className={s.lines}>
        {rows.map((r) => (
          <li key={r.name + r.what} className={s.line}>
            <span className={s.lineName}>{r.name}</span>
            <span className={s.lineWhat}>{r.what}</span>
            <span className={cx(s.lineValue, r.tone === 'bad' ? s.bad : r.tone === 'good' ? s.good : s.neutralText)}>{r.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A small stat box in a detail: "$1,554 made". */
export function DetailStat({ value, label, tone }: { value: ReactNode; label: string; tone?: 'bad' | 'good' | 'clay' }) {
  return (
    <div className={s.dstat}>
      <div className={cx(s.dstatValue, tone && s[`dstat_${tone}`])}>{value}</div>
      <div className={s.dstatLabel}>{label}</div>
    </div>
  );
}

/** The last 8 periods of N days, current one highlighted, against a goal or the average. */
export function PeriodTrend({
  values,
  n,
  todayStart,
  format,
  isGood,
  goal,
  label,
  note,
  max,
}: {
  values: number[];
  n: RangeDays;
  todayStart: number;
  format: (v: number) => string;
  isGood: (v: number) => boolean;
  goal?: { value: number; label: string };
  label: string;
  note: string;
  max?: number;
}) {
  return (
    <div className={s.block}>
      <BoCaption>Last 8 periods of {n} days</BoCaption>
      <BarChart
        label={label}
        height={70}
        ceil={max}
        goal={goal}
        data={values.map((v, i) => {
          const k = values.length - 1 - i;
          const good = isGood(v);
          const current = k === 0;
          return {
            key: String(k),
            label: periodLabel(k, n, todayStart),
            segments: [{ value: v, name: label, color: current ? (good ? CHART.good : CHART.bad) : good ? CHART.goodSoft : CHART.badSoft }],
            valueLabel: format(v),
            highlight: current,
            description: `${current ? `Last ${n} days` : `${n} days to ${periodLabel(k, n, todayStart)}`}: ${format(v)}${goal ? ` (goal ${goal.value})` : ''}, ${good ? 'on track' : 'off track'}`,
          };
        })}
      />
      <p className={s.chartNote}>{note}</p>
    </div>
  );
}

/** Detail dialog for the whole range ("Trend assessment · last 7 days"). */
export function RangeModal({ title, n, onClose, children }: { title: string; n: number; onClose: () => void; children: ReactNode }) {
  return (
    <Modal open onClose={onClose} width={620} title={<ModalTitle cap={`Trend assessment · last ${n} days`} title={title} />}>
      <div className={s.modalBody}>{children}</div>
    </Modal>
  );
}

/** Detail dialog for one day, stepping to the day before or after (also with the arrow keys). */
export function DayModal({
  cap,
  dayTitle,
  index,
  count,
  setIndex,
  onClose,
  children,
}: {
  cap: string;
  dayTitle: string;
  index: number;
  count: number;
  setIndex: (i: number) => void;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest('input, textarea, select')) return;
      if (e.key === 'ArrowLeft' && index > 0) setIndex(index - 1);
      if (e.key === 'ArrowRight' && index < count - 1) setIndex(index + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, count, setIndex]);
  return (
    <Modal open onClose={onClose} width={680} title={<ModalTitle cap={cap} title={dayTitle} />}>
      <div className={s.dayNav}>
        <Button size="sm" variant="ghost" icon={<ChevronLeft size={15} />} disabled={index === 0} onClick={() => setIndex(index - 1)}>
          Day before
        </Button>
        <Button size="sm" variant="ghost" iconRight={<ChevronRight size={15} />} disabled={index >= count - 1} onClick={() => setIndex(index + 1)}>
          Day after
        </Button>
      </div>
      <div className={s.modalBody}>{children}</div>
    </Modal>
  );
}

function ModalTitle({ cap, title }: { cap: string; title: string }) {
  return (
    <span className={s.modalTitle}>
      <span className={s.modalCap}>{cap}</span>
      <span>{title}</span>
    </span>
  );
}
