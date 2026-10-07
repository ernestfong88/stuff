import { ChevronRight, Menu } from 'lucide-react';
import { ModeChip, TextZoom } from '../../../shell/controls';
import { findPage, type BoPageDef, type BoSectionDef } from '../nav';
import s from './TopBar.module.css';

interface Props {
  section: BoSectionDef;
  page: BoPageDef;
  goto: (pageId: string) => void;
  /** Shown on narrow windows, where the side nav is a drawer. */
  onOpenNav: () => void;
  navOpen: boolean;
}

/** Sticky breadcrumb bar: section › page, with text size and mode on the right. */
export function TopBar({ section, page, goto, onOpenNav, navOpen }: Props) {
  const Icon = section.icon;
  const parent = page.parent ? findPage(page.parent)?.page : undefined;
  const showPage = section.pages.length > 1 || !!parent;
  return (
    <header className={s.bar}>
      <button className={s.menu} onClick={onOpenNav} aria-label="Open the page menu" aria-expanded={navOpen} aria-controls="bo-side-nav">
        <Menu size={20} />
      </button>
      <nav className={s.crumbs} aria-label="Breadcrumb">
        <Icon size={15} className={s.sectionIcon} aria-hidden />
        <span className={s.section}>{section.label}</span>
        {parent && (
          <>
            <ChevronRight size={14} className={s.sep} aria-hidden />
            <button className={s.parent} onClick={() => goto(parent.id)}>
              {parent.label}
            </button>
          </>
        )}
        {showPage && (
          <>
            <ChevronRight size={14} className={s.sep} aria-hidden />
            <span className={s.page} aria-current="page">
              {page.label}
            </span>
          </>
        )}
      </nav>
      <div className={s.controls}>
        <TextZoom />
        <ModeChip />
      </div>
    </header>
  );
}
