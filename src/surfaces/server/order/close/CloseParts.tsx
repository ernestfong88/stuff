import { Check, CreditCard, Gift, Home } from 'lucide-react';
import { dinerName } from '../../../../domain/orders';
import { formatMoney } from '../../../../lib/format';
import { cx } from '../../../../ui';
import s from './CloseParts.module.css';
import { totalBreakdown, type CloseRow, type CloseView } from './closeMath';

/** One person's band: the amount in large type and where it goes. */
export function CloseBand({ view }: { view: CloseView }) {
  const Icon = view.how === 'card' ? CreditCard : view.how === 'apt' ? Home : view.k === 'comp' ? Gift : Check;
  const big = view.amt > 0;
  return (
    <div className={cx(s.band, s[view.tone], big && s.bandBig)}>
      <span className={s.bandIcon}>
        <Icon size={17} strokeWidth={2.4} aria-hidden />
      </span>
      <span className={cx(s.bandAmt, big && s.bandAmtBig)}>{formatMoney(view.amt)}</span>
      <span className={s.bandText}>
        <span className={s.bandTitle}>{view.title}</span>
        {view.sub && <span className={s.bandSub}>{view.sub}</span>}
      </span>
    </div>
  );
}

/** A table of two or more gets a summary with each person and the table total first. */
export function CloseSummary({ rows, views, total }: { rows: CloseRow[]; views: CloseView[]; total: number }) {
  return (
    <div className={cx(s.summary, 'fade-in')}>
      {rows.map((r, i) => {
        const v = views[i];
        return (
          <div key={r.diner.id} className={s.sumRow}>
            <span className={cx(s.dot, s[`dot_${v.tone}`])} aria-hidden />
            <span className={s.sumWho}>
              <span className={s.sumName}>{dinerName(r.diner)}</span>
              <span className={cx(s.sumTitle, s[`ink_${v.tone}`])}>{v.title}</span>
            </span>
            <span className={cx(s.sumAmt, v.amt > 0 && s.sumAmtBig, s[`amt_${v.tone}`])}>{formatMoney(v.amt)}</span>
          </div>
        );
      })}
      <div className={s.sumTotal}>
        <span className={s.sumTotalLabel}>Table total</span>
        <span className={cx(s.sumTotalAmt, total <= 0 && s.zero)}>{formatMoney(total)}</span>
      </div>
    </div>
  );
}

/** The footer total: what the table is charged and where it goes. */
export function CloseTotal({ views, total }: { views: CloseView[]; total: number }) {
  const parts = totalBreakdown(views);
  return (
    <div className={s.total}>
      <div className={s.totalLabel}>{total > 0 ? 'Table total to charge' : 'Table total'}</div>
      <div className={cx(s.totalAmt, total <= 0 && s.zero)}>{formatMoney(total)}</div>
      {parts && <div className={s.totalParts}>{parts}</div>}
    </div>
  );
}
