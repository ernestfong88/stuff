/**
 * Venues and the menus they serve, as the back office had them when the
 * prototype was captured. The dashboard reads it for "venue has no menu"
 * and "menu starts this week".
 */
import venuesJson from './venues.json';

export interface VenueMenus {
  id: string;
  name: string;
  active: boolean;
  /** The menu served now, or null. */
  menuId: string | null;
  /** Menus scheduled to take over, with their start date ("YYYY-MM-DDT00:00:00"). */
  upcoming: Array<{ menuId: string; startDt: string }>;
}

export interface MenuName {
  id: string;
  name: string;
  status: string;
}

const seed = venuesJson as unknown as { venues: VenueMenus[]; menus: MenuName[] };

export const VENUE_MENUS: VenueMenus[] = seed.venues;
export const MENU_NAMES: MenuName[] = seed.menus;
