/**
 * Back office routing: #/backoffice/<pageId>. An unknown or missing page id
 * shows the dashboard and the address is corrected in place.
 */
import { useCallback, useEffect } from 'react';
import { navigate, useRoute } from '../../../shell/router';
import { BO_ALIASES, DEFAULT_BO_PAGE, findPage, type BoPageDef, type BoSectionDef } from '../nav';

export function gotoPage(pageId: string): void {
  const alias = BO_ALIASES.find((a) => a.id === pageId);
  navigate('backoffice', alias ? alias.to : [pageId]);
}

export function useBoPage(): { section: BoSectionDef; page: BoPageDef; goto: (pageId: string) => void } {
  const route = useRoute();
  const alias = BO_ALIASES.find((a) => a.id === route.path[0]);
  // An old page that became a tab: open the tab, keeping anything after it (a resident's id).
  const target = alias ? [...alias.to, ...route.path.slice(1)] : route.path;
  const requested = target[0];
  const found = findPage(requested) ?? findPage(DEFAULT_BO_PAGE);
  if (!found) throw new Error(`Back office default page "${DEFAULT_BO_PAGE}" is missing from nav.ts`);
  const pageId = found.page.id;
  const aliasTo = alias ? target.join('/') : '';
  useEffect(() => {
    if (aliasTo) navigate('backoffice', aliasTo.split('/'), { replace: true });
    else if (requested !== pageId) navigate('backoffice', [pageId], { replace: true });
  }, [aliasTo, requested, pageId]);
  const goto = useCallback((id: string) => gotoPage(id), []);
  return { ...found, goto };
}
