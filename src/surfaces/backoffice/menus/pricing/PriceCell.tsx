import { useState } from 'react';
import { cx } from '../../../../ui';
import { MoneyInput } from '../ui/controls';
import s from './PricingPage.module.css';

const money = (v: number) => `$${Number.isInteger(v) ? v : v.toFixed(2)}`;

/**
 * One venue price. While typing, the box keeps what was typed, even a blank,
 * so clearing a price to type another doesn't snap back to the menu price.
 * A price the venue changed shows in blue, with a way back to the menu's.
 */
export function PriceCell({ value, menuPrice, onChange, label }: { value: number | null; menuPrice: number | null; onChange: (v: number | null) => void; label: string }) {
  const [draft, setDraft] = useState<number | null | undefined>(undefined);
  const changed = value != null && value !== menuPrice;
  return (
    <span className={s.cell}>
      <MoneyInput
        value={draft !== undefined ? draft : (value ?? menuPrice)}
        onChange={(x) => {
          setDraft(x);
          if (x != null) onChange(x);
        }}
        onBlur={() => setDraft(undefined)}
        aria-label={label}
        className={cx(changed && s.changed)}
      />
      {changed && (
        <button className={s.useMenu} onClick={() => onChange(null)} aria-label={`${label}: use the menu price`}>
          Use menu price{menuPrice != null ? ` ${money(menuPrice)}` : ''}
        </button>
      )}
    </span>
  );
}
