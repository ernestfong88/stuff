import { BookOpen, MoreHorizontal } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { cx, MenuItem, Popover } from '../../ui';
import { MenuReference } from './features';
import s from './ServerNav.module.css';

export interface HeaderPage {
  label: string;
  icon: ReactNode;
  /** This page is showing now. */
  active?: boolean;
  onClick: () => void;
}

/**
 * The header's page buttons folded into one More menu, for a narrow header
 * (upright tablet, large text): today's menu, then the pages. The button
 * stays "on" while one of those pages is showing.
 */
export function HeaderMore({ pages }: { pages: HeaderPage[] }) {
  const [menu, setMenu] = useState(false);
  const on = pages.find((p) => p.active);
  return (
    <>
      <Popover
        minWidth={230}
        trigger={({ open, toggle }) => (
          <button
            className={cx(s.btn, s.more, on && s.on)}
            onClick={toggle}
            title={on ? `${on.label}. More pages` : 'Menu, Residents, Shift Review'}
            aria-label={on ? `More, showing ${on.label}` : 'More'}
            aria-haspopup="menu"
            aria-expanded={open}
          >
            <MoreHorizontal size={18} strokeWidth={2.5} aria-hidden />
          </button>
        )}
      >
        {({ close }) => (
          <>
            <MenuItem
              icon={<BookOpen size={16} />}
              onClick={() => {
                close();
                setMenu(true);
              }}
            >
              Menu
            </MenuItem>
            {pages.map((p) => (
              <MenuItem
                key={p.label}
                icon={p.icon}
                active={p.active}
                onClick={() => {
                  close();
                  p.onClick();
                }}
              >
                {p.label}
              </MenuItem>
            ))}
          </>
        )}
      </Popover>
      {menu && <MenuReference onClose={() => setMenu(false)} />}
    </>
  );
}
