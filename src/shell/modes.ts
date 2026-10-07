/**
 * The twelve surfaces of KiscoConnect Dining. Each physical device runs one
 * of them; the URL hash picks which (#/cook, #/expo, #/server ...), so a
 * kitchen screen can be bookmarked straight to its surface.
 */
export type ModeId =
  | 'server'
  | 'manager'
  | 'host'
  | 'bar'
  | 'pud'
  | 'cook'
  | 'expo'
  | 'prep'
  | 'assocphone'
  | 'kiosk'
  | 'display'
  | 'backoffice';

/** The device class decides the chrome: tablet header, dark kitchen screen, phone frame ... */
export type DeviceKind = 'tablet' | 'kitchen' | 'phone' | 'kiosk' | 'display' | 'desktop';

export interface Mode {
  id: ModeId;
  label: string;
  device: DeviceKind;
  /** Dark UI (kitchen line, expo, specials TV). */
  dark?: boolean;
  /** One-line description for the mode menu and docs. */
  blurb: string;
}

export const MODES: Mode[] = [
  { id: 'server', label: 'Server', device: 'tablet', blurb: 'Tables, checks, menu and residents' },
  { id: 'manager', label: 'Manager', device: 'tablet', blurb: 'Triage, floor, metrics and the 86 list' },
  { id: 'host', label: 'Host', device: 'tablet', blurb: 'Seat parties and manage reservations' },
  { id: 'bar', label: 'Bar', device: 'tablet', blurb: 'Drinks sent to the bar' },
  { id: 'pud', label: 'PU & Delivery', device: 'tablet', blurb: 'Pick up and delivery queue' },
  { id: 'cook', label: 'Cook', device: 'kitchen', dark: true, blurb: 'Kitchen display for the line' },
  { id: 'expo', label: 'Expo', device: 'kitchen', dark: true, blurb: 'Pass: course pacing and runs' },
  { id: 'prep', label: 'Production Prep', device: 'kitchen', blurb: 'Production plan and checklists' },
  { id: 'assocphone', label: 'Associate Phone', device: 'phone', blurb: 'Associates plan their shift meals' },
  { id: 'kiosk', label: 'Resident Kiosk', device: 'kiosk', blurb: 'Residents order pick up or delivery' },
  { id: 'display', label: 'Specials Display', device: 'display', dark: true, blurb: "Tonight's specials on the dining room TV" },
  { id: 'backoffice', label: 'Back Office', device: 'desktop', blurb: 'Culinary back office' },
];

export const DEFAULT_MODE: ModeId = 'server';

export function getMode(id: string | null | undefined): Mode {
  return MODES.find((m) => m.id === id) ?? MODES[0];
}
