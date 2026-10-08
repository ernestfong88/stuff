import { navigate, useRoute } from '../../../shell/router';

/**
 * A page's tab kept in the address, #/backoffice/<page>/<tab>, so a tab can
 * be linked to and the browser's back button steps between tabs.
 */
export function usePageTab<T extends string>(page: string, tabs: readonly T[]): [T, (tab: T) => void] {
  const route = useRoute();
  const want = route.path[0] === page ? route.path[1] : undefined;
  const tab = tabs.find((t) => t === want) ?? tabs[0];
  return [tab, (t: T) => navigate('backoffice', t === tabs[0] ? [page] : [page, t], { replace: true })];
}

/**
 * The tab of a page made of former pages (BoTabbedPage). The first tab owns
 * the bare address and anything after it, so its own links (a resident's id,
 * a sub-tab) keep working; the others are #/backoffice/<page>/<tab>.
 */
export function useHubTab<T extends string>(page: string, tabs: readonly T[]): [T, (tab: string) => void] {
  const route = useRoute();
  const want = route.path[0] === page ? route.path[1] : undefined;
  const tab = tabs.find((t) => t === want) ?? tabs[0];
  return [tab, (t: string) => navigate('backoffice', t === tabs[0] ? [page] : [page, t])];
}
