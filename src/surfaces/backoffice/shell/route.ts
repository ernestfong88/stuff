/**
 * Back office routing: #/backoffice/<pageId>. An unknown or missing page id
 * shows the dashboard and the address is corrected in place.
 */
import { useCallback, useEffect } from 'react';
import { navigate, useRoute } from '../../../shell/router';
import { DEFAULT_BO_PAGE, findPage, type BoPageDef, type BoSectionDef } from '../nav';

export function gotoPage(pageId: string): void {
  navigate('backoffice', [pageId]);
}

export function useBoPage(): { section: BoSectionDef; page: BoPageDef; goto: (pageId: string) => void } {
  const route = useRoute();
  const requested = route.path[0];
  const found = findPage(requested) ?? findPage(DEFAULT_BO_PAGE);
  if (!found) throw new Error(`Back office default page "${DEFAULT_BO_PAGE}" is missing from nav.ts`);
  const pageId = found.page.id;
  useEffect(() => {
    if (requested !== pageId) navigate('backoffice', [pageId], { replace: true });
  }, [requested, pageId]);
  const goto = useCallback((id: string) => gotoPage(id), []);
  return { ...found, goto };
}
