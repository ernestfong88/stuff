/**
 * Minimal hash router: #/<mode>/<sub>/<path>?<query>
 *
 * Hash routing keeps the app deployable as static files (no server rewrites)
 * and lets each device be bookmarked to its surface, e.g. #/expo or
 * #/backoffice/billing. Surfaces own everything after the mode segment.
 */
import { useSyncExternalStore } from 'react';
import { DEFAULT_MODE, getMode, type ModeId } from './modes';

export interface Route {
  mode: ModeId;
  /** Path segments after the mode, e.g. ['billing'] for #/backoffice/billing. */
  path: string[];
  query: URLSearchParams;
}

function parse(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '');
  const [pathPart, queryPart = ''] = raw.split('?');
  const segs = pathPart.split('/').filter(Boolean).map(decodeURIComponent);
  const mode = segs.length ? getMode(segs[0]).id : DEFAULT_MODE;
  // An unknown first segment falls back to the default mode with no sub-path.
  const valid = segs.length > 0 && getMode(segs[0]).id === segs[0];
  return { mode, path: valid ? segs.slice(1) : [], query: new URLSearchParams(queryPart) };
}

let current = parse(window.location.hash);
const listeners = new Set<() => void>();

window.addEventListener('hashchange', () => {
  current = parse(window.location.hash);
  listeners.forEach((l) => l());
});

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function getRoute(): Route {
  return current;
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, getRoute, getRoute);
}

export function buildHash(mode: ModeId, path: string[] = [], query?: Record<string, string | undefined>): string {
  const segs = [mode, ...path].map(encodeURIComponent).join('/');
  const q = query ? new URLSearchParams(Object.entries(query).filter(([, v]) => v != null) as [string, string][]).toString() : '';
  return '#/' + segs + (q ? '?' + q : '');
}

/** Go to a surface (and optional sub-path). replace: don't add a history entry. */
export function navigate(mode: ModeId, path: string[] = [], opts: { replace?: boolean; query?: Record<string, string | undefined> } = {}): void {
  const hash = buildHash(mode, path, opts.query);
  if (hash === window.location.hash) return;
  if (opts.replace) {
    window.history.replaceState(null, '', hash);
    current = parse(hash);
    listeners.forEach((l) => l());
  } else {
    window.location.hash = hash;
  }
}

/**
 * Sub-route helper for a surface: the first path segment as a "view" with a
 * fallback, plus a setter that keeps the mode.
 *
 *   const [view, setView] = useView('mine');   // #/server/mine
 */
export function useView<T extends string>(fallback: T): [T, (view: T, rest?: string[]) => void, string[]] {
  const r = useRoute();
  const view = (r.path[0] as T) || fallback;
  return [view, (v, rest = []) => navigate(r.mode, [v, ...rest]), r.path.slice(1)];
}
