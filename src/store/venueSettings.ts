/**
 * Venue settings, shared by the Back Office (Venue Settings, Kitchen
 * Routing) and the kitchen screens: which menu each venue serves, its
 * printers and payment terminals, and each kitchen's KDS screens and
 * whether it has an expo station.
 *
 * Venues are dining rooms as the Back Office names them; several can share
 * one kitchen ("room": Sequoia and Evergreen both cook in the Sequoia
 * kitchen). KDS screens and expo belong to the kitchen.
 *
 * Persisted and synced across tabs, so a screen renamed in the Back Office
 * shows on the cook line straight away.
 */
import type { PrintRoute } from '../domain/printing';
import { rooms } from '../data';
import { revive } from '../data/revive';
import { createSharedStore, useShared } from '../lib/sharedStore';
import { safeStorage } from '../lib/storage';
import { screenKey, singleScreen, type KdsScreen } from '../domain/kdsScreens';
import seed from '../data/seed/venueSettings.json';

export interface UpcomingMenu {
  menuId: string;
  /** Day the menu starts (ms). */
  startDt: number;
}

export interface Venue {
  id: string;
  name: string;
  /** Kitchen the venue cooks in (a key of rooms), or null when it has none. */
  room: string | null;
  menuId: string | null;
  /** Day 1 of the menu cycle (ms). */
  menuStartDt: number | null;
  /** Retired venues are kept (layouts, prices and history) but hidden. */
  active: boolean;
  upcoming: UpcomingMenu[];
}

export interface MenuSummary {
  id: string;
  name: string;
  season: string;
  quarter: string;
  /** "cycle" rotates by day; "alc" is the same every day. */
  kind: 'cycle' | 'alc' | string;
  status: 'active' | 'draft' | 'archived' | string;
  /** Days in the cycle; 0 for a static menu. */
  cycleLen: number;
}

export type PrinterType = 'Kitchen' | 'Receipt' | 'Label';

export interface Printer {
  id: string;
  name: string;
  type: PrinterType | string;
  ip: string;
  active: boolean;
  reachable: boolean;
  /** Printer mode: the whole ticket, or only some groups of items (see domain/printing). */
  print?: PrintRoute;
}

export interface PrinterLink {
  id: string;
  printerId: string;
  venueId: string;
}

export interface PaymentTerminal {
  id: string;
  name: string;
  venueId: string;
  online: boolean;
  lastSeen: number | null;
}

export interface VenueSettings {
  venues: Venue[];
  printers: Printer[];
  printerLinks: PrinterLink[];
  terminals: PaymentTerminal[];
  /** Cook screens per kitchen; a kitchen not listed has one screen. */
  kds: Record<string, KdsScreen[]>;
  /** Expo station per kitchen; not set means "yes when it has two or more screens". */
  expo: Record<string, boolean>;
}

const initial = (): VenueSettings => revive(seed as unknown as VenueSettings);

export const venueSettingsStore = createSharedStore<VenueSettings>(initial, {
  persistKey: 'kisco_venue_settings_v1',
  channel: 'kisco-venue-settings',
});

export function useVenueSettings(): VenueSettings {
  return useShared(venueSettingsStore);
}

const update = (fn: (s: VenueSettings) => VenueSettings) => venueSettingsStore.set(fn);

// ─── Kitchens ────────────────────────────────────────────────────────────

/** A kitchen's cook screens (one screen showing everything when not set). */
export function kitchenScreens(s: VenueSettings, room: string): KdsScreen[] {
  const list = s.kds[room];
  return list && list.length ? list : singleScreen();
}

/**
 * Does the kitchen run an expo station? A kitchen with one cook screen
 * usually has no one on expo, so until a venue says otherwise, one screen
 * means the server runs the course.
 */
export function kitchenHasExpo(s: VenueSettings, room: string): boolean {
  const v = s.expo[room];
  return v != null ? v : kitchenScreens(s, room).length > 1;
}

export interface ScreenOption {
  key: string;
  name: string;
  room: string;
  roomName: string;
}

/** Every cook screen in the community, kitchen by kitchen. */
export function screenOptions(s: VenueSettings): ScreenOption[] {
  return Object.entries(rooms).flatMap(([room, r]) =>
    kitchenScreens(s, room).map((screen, i) => ({
      key: screenKey(room, i),
      name: screen.name.trim() || 'Screen ' + (i + 1),
      room,
      roomName: r.name,
    })),
  );
}

export function setKitchenScreens(room: string, screens: KdsScreen[]): void {
  update((s) => ({ ...s, kds: { ...s.kds, [room]: screens } }));
}

export function setKitchenExpo(room: string, on: boolean): void {
  update((s) => ({ ...s, expo: { ...s.expo, [room]: on } }));
}

// ─── This device's screen ────────────────────────────────────────────────

const DEVICE_SCREEN_KEY = 'kisco_kds_screen';

/** Which cook screen this device is, saved on the device only. */
export const deviceScreenStore = createSharedStore<string | null>(() => safeStorage.get(DEVICE_SCREEN_KEY));

export function setDeviceScreen(key: string): void {
  safeStorage.set(DEVICE_SCREEN_KEY, key);
  deviceScreenStore.set(key);
}

/** The screen this device shows; the first screen when its saved one no longer exists. */
export function useDeviceScreen(): ScreenOption {
  const saved = useShared(deviceScreenStore);
  const options = screenOptions(useVenueSettings());
  return options.find((o) => o.key === saved) ?? options[0];
}

// ─── Venues ──────────────────────────────────────────────────────────────

export function patchVenue(id: string, patch: Partial<Venue>): void {
  update((s) => ({ ...s, venues: s.venues.map((v) => (v.id === id ? { ...v, ...patch } : v)) }));
}

export function addVenue(venue: Venue): void {
  update((s) => ({ ...s, venues: [...s.venues, venue] }));
}

/** Start a menu on a venue now, or line it up to start on a later day. */
export function scheduleMenu(venueId: string, menuId: string, startDt: number, startsLater: boolean): void {
  update((s) => ({
    ...s,
    venues: s.venues.map((v) => {
      if (v.id !== venueId) return v;
      if (!startsLater) return { ...v, menuId, menuStartDt: startDt };
      const day = new Date(startDt).toDateString();
      return {
        ...v,
        upcoming: [...v.upcoming.filter((u) => new Date(u.startDt).toDateString() !== day), { menuId, startDt }],
      };
    }),
  }));
}

export function removeUpcoming(venueId: string, startDt: number): void {
  update((s) => ({
    ...s,
    venues: s.venues.map((v) => (v.id === venueId ? { ...v, upcoming: v.upcoming.filter((u) => u.startDt !== startDt) } : v)),
  }));
}

// ─── Printers ────────────────────────────────────────────────────────────

export function venuePrinters(s: VenueSettings, venueId: string): Array<{ link: PrinterLink; printer: Printer }> {
  return s.printerLinks.flatMap((link) => {
    const printer = link.venueId === venueId ? s.printers.find((p) => p.id === link.printerId) : undefined;
    return printer ? [{ link, printer }] : [];
  });
}

/** The printers of every venue that cooks in a kitchen. */
export function kitchenPrinters(s: VenueSettings, room: string): Printer[] {
  const venueIds = new Set(s.venues.filter((v) => v.active && v.room === room).map((v) => v.id));
  const ids = new Set(s.printerLinks.filter((l) => venueIds.has(l.venueId)).map((l) => l.printerId));
  return s.printers.filter((p) => ids.has(p.id));
}

/** Set what a printer prints: the whole ticket or only some groups. */
export function setPrinterRoute(printerId: string, print: PrintRoute): void {
  update((s) => ({ ...s, printers: s.printers.map((p) => (p.id === printerId ? { ...p, print } : p)) }));
}

export function linkPrinter(link: PrinterLink): void {
  update((s) => ({ ...s, printerLinks: [...s.printerLinks, link] }));
}

export function unlinkPrinter(linkId: string): void {
  update((s) => ({ ...s, printerLinks: s.printerLinks.filter((l) => l.id !== linkId) }));
}

export function addPrinter(printer: Printer, venueId: string, linkId: string): void {
  update((s) => ({
    ...s,
    printers: [...s.printers, printer],
    printerLinks: [...s.printerLinks, { id: linkId, printerId: printer.id, venueId }],
  }));
}

// ─── Menus ───────────────────────────────────────────────────────────────

/**
 * Venue Settings as its admin page shows it: the stored settings plus the
 * menus a venue can be bound to, which Menu Cycle & À la Carte owns.
 */
export interface VenueAdminView extends VenueSettings {
  menus: MenuSummary[];
}

export function menuById(s: Pick<VenueAdminView, 'menus'>, id: string | null | undefined): MenuSummary | undefined {
  return id ? s.menus.find((m) => m.id === id) : undefined;
}
