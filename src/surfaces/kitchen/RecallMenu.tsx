import { RotateCcw } from 'lucide-react';
import { Popover } from '../../ui';
import { HeaderButton } from './KitchenShell';
import s from './RecallMenu.module.css';

export interface RecallItem {
  id: string;
  label: string;
  meta?: string;
}

/**
 * RECALL n: the last tickets this screen bumped. Tapping one brings it
 * back. Hidden while there is nothing to bring back.
 */
export function RecallMenu({ title, items, onRecall }: { title: string; items: RecallItem[]; onRecall: (id: string) => void }) {
  if (!items.length) return null;
  return (
    <Popover
      className={s.menu}
      minWidth={260}
      trigger={({ open, toggle }) => (
        <HeaderButton icon={<RotateCcw size={15} strokeWidth={2.5} />} on={open} onClick={toggle} aria-haspopup="menu" aria-expanded={open}>
          RECALL {items.length}
        </HeaderButton>
      )}
    >
      {({ close }) => (
        <>
          <div className={s.title}>{title}</div>
          {items.map((it) => (
            <button
              key={it.id}
              role="menuitem"
              className={s.item}
              onClick={() => {
                onRecall(it.id);
                close();
              }}
            >
              <RotateCcw size={14} strokeWidth={2.5} className={s.icon} />
              <span className={s.label}>{it.label}</span>
              {it.meta && <span className={s.meta}>{it.meta}</span>}
            </button>
          ))}
        </>
      )}
    </Popover>
  );
}
