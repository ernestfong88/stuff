import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { cx, useViewportWidth } from '../../../ui';
import { PageErrorBoundary } from './PageErrorBoundary';
import { PhaseBanner, PhaseOffPage } from './PhaseBanner';
import { pageOn, phaseOf, usePhaseOn, usePhasePlan } from '../phases';
import { PageLoading } from './PageLoading';
import { PagePalette } from './PagePalette';
import { useBoPage } from './route';
import { isSearchShortcut } from './shortcut';
import { SideNav } from './SideNav';
import { TopBar } from './TopBar';
import s from './BackOfficeShell.module.css';

/** Below this width the side nav is a drawer (keep in sync with the CSS). */
const DRAWER_BELOW = 1200;

/** The culinary back office: side nav, breadcrumb bar, Ctrl K page search and the current page. */
export function BackOfficeShell() {
  const { section, page, goto: go } = useBoPage();
  const plan = usePhasePlan();
  const pageIsOn = pageOn(page.id, plan, usePhaseOn());
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawer = useViewportWidth() < DRAWER_BELOW;
  const main = useRef<HTMLElement>(null);
  const Page = page.component;

  const goto = useCallback(
    (id: string) => {
      setPaletteOpen(false);
      setDrawerOpen(false);
      go(id);
    },
    [go],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isSearchShortcut(e)) return;
      e.preventDefault();
      setPaletteOpen((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // A new page starts at the top, like a new document.
  useEffect(() => {
    if (main.current) main.current.scrollTop = 0;
    document.title = `${page.label} · KiscoConnect Culinary`;
  }, [page.id, page.label]);

  useEffect(() => {
    if (!drawer) setDrawerOpen(false);
  }, [drawer]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawerOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  return (
    <div className={s.shell}>
      <aside
        id="bo-side-nav"
        className={cx(s.nav, drawerOpen && s.navOpen)}
        aria-label="Back office menu"
        inert={drawer && !drawerOpen ? true : undefined}
      >
        <SideNav
          pageId={page.id}
          section={section}
          goto={goto}
          onSearch={() => {
            setDrawerOpen(false);
            setPaletteOpen(true);
          }}
          onClose={drawer ? () => setDrawerOpen(false) : undefined}
        />
      </aside>
      {drawer && drawerOpen && <div className={s.scrim} onClick={() => setDrawerOpen(false)} aria-hidden />}
      <main ref={main} className={s.main} tabIndex={-1}>
        <TopBar section={section} page={page} goto={goto} navOpen={drawerOpen} onOpenNav={() => setDrawerOpen(true)} />
        <div className={s.content}>
          <PhaseBanner pageId={page.id} goto={goto} />
          <PageErrorBoundary resetKey={page.id} pageLabel={page.label}>
            {pageIsOn ? (
              <Suspense fallback={<PageLoading />}>
                <Page key={page.id} goto={goto} />
              </Suspense>
            ) : (
              <PhaseOffPage phase={phaseOf(page.id, plan)} goto={goto} />
            )}
          </PageErrorBoundary>
        </div>
      </main>
      {paletteOpen && <PagePalette onClose={() => setPaletteOpen(false)} goto={goto} />}
    </div>
  );
}
