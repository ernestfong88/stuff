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
