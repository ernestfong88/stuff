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
  /** A page this user can't open (HO Settings for a community user): no section or page name. */
  hidden?: boolean;
}

/** Sticky breadcrumb bar: section › page, with text size and mode on the right. */
export function TopBar({ section, page, goto, onOpenNav, navOpen, hidden }: Props) {
  const Icon = section.icon;
  const parent = page.parent ? findPage(page.parent)?.page : undefined;
  const showPage = section.pages.length > 1 || !!parent;
  return (
    <header className={s.bar}>
      <button className={s.menu} onClick={onOpenNav} aria-label="Open the page menu" aria-expanded={navOpen} aria-controls="bo-side-nav">
        <Menu size={20} />
      </button>
      {hidden ? (
        <span className={s.crumbs} />
      ) : (
        <nav className={s.crumbs} aria-label="Breadcrumb">
          <span className={s.sectionChip} aria-hidden>
            <Icon size={14} />
          </span>
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
      )}
      <div className={s.controls}>
        <TextZoom />
        <ModeChip />
      </div>
    </header>
  );
}
