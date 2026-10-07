import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { ModeId } from '../shell/modes';

/**
 * One lazily loaded bundle per surface, so the kitchen screen never
 * downloads the back office and vice versa.
 */
export const SURFACES: Record<ModeId, LazyExoticComponent<ComponentType>> = {
  server: lazy(() => import('./server')),
  manager: lazy(() => import('./manager')),
  host: lazy(() => import('./host')),
  bar: lazy(() => import('./bar')),
  pud: lazy(() => import('./pud')),
  cook: lazy(() => import('./cook')),
  expo: lazy(() => import('./expo')),
  prep: lazy(() => import('./prep')),
  assocphone: lazy(() => import('./assocphone')),
  kiosk: lazy(() => import('./kiosk')),
  display: lazy(() => import('./display')),
  backoffice: lazy(() => import('./backoffice')),
};

/** Floor devices that need an associate signed in with a PIN. */
export const NEEDS_SIGN_IN: ReadonlySet<ModeId> = new Set<ModeId>(['server', 'manager', 'host', 'bar', 'pud']);
