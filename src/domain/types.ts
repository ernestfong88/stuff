/**
 * Domain model for KiscoConnect Dining.
 *
 * Field names follow the original mockup's data so the seed data (dumped from
 * the mockup into src/data/seed) loads without translation.
 */

export type MealName = 'Breakfast' | 'Lunch' | 'Dinner';
export type CareLevel = 'IL' | 'AL' | 'MC' | string;
export type RoomId = 'sequoia' | 'bistro' | string;

// ─── People ──────────────────────────────────────────────────────────────

export interface Contact {
  name: string;
  rel: string;
}

export interface Resident {
  id: string;
  name: string;
  apt: string;
  level: CareLevel;
  /** Initials used for the avatar and its colour. */
  photo: string;
  diet: string[];
  allergies: string[];
  spouse?: string;
  fav?: string;
  /** Key into mealPlans. */
  plan: string;
  /** Meals used so far this cycle. */
  consumed: number;
  contacts?: Contact[];
  /** Texture or prep requirement, e.g. "Mechanical Altered", "Pureed". */
  foodPrep?: string;
}

export interface MealPlan {
  id: string;
  type: 'Monthly' | 'Daily' | 'A la carte' | string;
  label: string;
  amt: number;
  unit: string | null;
}

/** Community associates who can eat in the dining room (not dining staff). */
export interface Associate {
  id: string;
  name: string;
  photo: string;
  dept: string;
}

/** Dining staff who sign in with a PIN. */
export interface StaffMember {
  id: string;
  pin: string;
  name: string;
  initials: string;
  role: string;
}

// ─── Menu ────────────────────────────────────────────────────────────────

export interface ModOption {
  group: string;
  opts: string[];
  default?: string;
  multi?: boolean;
  [k: string]: unknown;
}

export interface MenuItem {
  id: string;
  name: string;
  desc: string;
  residentPrice: number;
  guestPrice: number;
  alaPrice: number;
  /** Day of the menu cycle the item is served (0 = every day). */
  day: number;
  /** Limited count for the service, null when unlimited. */
  avail: number | null;
  mods: ModOption[];
  allergens: string[];
  /** 0/1 = starters, 2 = entrées, 3 = desserts. */
  course?: number;
  special?: boolean;
  entree?: boolean;
  /** Entrée type: plate, pasta, sandwich, salad ... */
  etype?: string;
  protein?: string;
  cookNotes?: string;
  defaultSideIds?: string[];
  presets?: unknown[];
  /** Kitchen routing: "kds", "expo", "bar", "none". */
  route?: string;
  ctype?: string;
  creditKind?: string;
  upcharge?: boolean;
}

/** A menu item with the meal and category it was listed under. */
export interface CatalogItem extends MenuItem {
  meal: MealName;
  category: string;
}

export type Menu = Record<MealName, Record<string, MenuItem[]>>;

export interface ModGroup {
  id: string;
  name: string;
  mods: string[];
}

// ─── Floor ───────────────────────────────────────────────────────────────

export interface FloorBand {
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FloorTable {
  id: string;
  label: string;
  section: string;
  type: string;
  /** Position and size in percent of the floor plan. */
  x: number;
  y: number;
  w: number;
  h: number;
  shape?: 'round' | string;
}

export interface Room {
  name: string;
  menuStartDay: number;
  bands: FloorBand[];
  tables: FloorTable[];
}

// ─── Orders ──────────────────────────────────────────────────────────────

/**
 * Where a sent line is. Food: scheduled (held for its course) → cooking →
 * ready (at the pass) → cleared (on the table). Drinks: pour (the server
 * makes it) or bar (being made) → up (ready at the bar) → cleared.
 */
export type KitchenState = 'scheduled' | 'cooking' | 'ready' | 'cleared' | 'bar' | 'pour' | 'up' | null;

export type ModSelection = Record<string, string | string[]>;

export interface OrderLine {
  id: string;
  itemId: string;
  mods: ModSelection;
  note: string;
  sent: boolean;
  kitchenState: KitchenState;
  course?: number;
  courseOverride?: number;
  firedAt?: number;
  clearedAt?: number;
  readyAtMs?: number;
  /** A side that came with an entrée; parentId points at the entrée line. */
  autoSide?: boolean;
  parentId?: string;
  /** Default side ids at the time the entrée was added. */
  dfs?: string[];
  rush?: boolean;
  toGo?: boolean;
  cancelled?: boolean;
  cancelledAt?: number;
  comped?: boolean;
  hold?: boolean;
  holdAt?: number | null;
  drink?: boolean;
  /** When a bar drink came up. */
  upAt?: number;
  /** Server reminders dismissed for this line. */
  rmOff?: string[];
  [k: string]: unknown;
}

export interface Diner {
  id: string;
  kind: 'resident' | 'associate';
  refId: string;
  isGuest: boolean;
  seat: number;
  items: OrderLine[];
  guestName?: string;
  guestRel?: string;
  feedback?: unknown;
  /** How the diner's meal was paid when closed: plan, apt, card, comp ... */
  chargeDrop?: string | null;
  chargeAmt?: number;
  mealPlanText?: string;
  [k: string]: unknown;
}

export interface CheckIn {
  course: number;
  at: number;
  by: string;
}

export type QueueType = 'pickup' | 'delivery';

/** Manager comp on a whole check. */
export interface OrderComp {
  reason: string;
  at?: number;
}

/** A sick-tray delivery fee waiver granted on a delivery order. */
export interface SickTray {
  /** Resident the waiver counts against. */
  rid: string;
  /** Waiver number this period, fixed when granted. */
  n: number;
  by: string;
  at: number;
  /** Granted past the allowance with a manager PIN. */
  mgr?: boolean;
}

/** One entry of a check's activity trail. */
export interface OrderLogEvent {
  at: number;
  /** Event kind: open, seat, add, send, fire, ready, run ... */
  k: string;
  by: string;
  what: string;
  /** Course the event refers to, when there is one. */
  c?: number;
}

/** Course pacing chosen on a check (setOrderPacing). */
export type FireMode = 'timer' | 'manual' | 'served' | string;

export interface Order {
  id: string;
  /** Dine-in table; absent for pick up and delivery orders. */
  tableId?: string;
  room: RoomId;
  /** Staff initials of the server who owns the check. */
  server: string;
  meal: MealName;
  openedAt: number;
  diners: Diner[];
  queueType?: QueueType;
  /** Pick up / delivery window start, "4:15 PM". */
  readyAt?: string;
  /** Pick up / delivery booked for a later day, "YYYY-MM-DD". */
  forDate?: string;
  deliveryFeeId?: string;
  sentAt?: number;
  drinksAt?: number;
  /** Pick up / delivery: when the scheduled lines fire on their own. */
  fireAtTs?: number;
  /** When every live plate reached the pass (cleared when one goes back). */
  readyStampAt?: number | null;
  notified?: boolean;
  notifiedAt?: number;
  remindedAt?: number;
  pickedUpAt?: number;
  textedOnWayAt?: number;
  deliveredAt?: number;
  checkIns?: CheckIn[];
  noDessert?: boolean;
  sickTray?: SickTray | null;
  /** Hospice fee waiver switched off for this order. */
  hospiceOff?: { by: string; at: number } | null;
  assoc?: boolean;
  assocName?: string;
  hostSeated?: boolean;
  greetedAt?: number;
  closedAt?: number;
  closedBy?: string;
  comp?: OrderComp | null;
  feeComped?: boolean;
  /** Letter for a second (third ...) check at the same table. */
  checkTag?: string;
  /** Bottles brought in; charged per venue on seat 1. */
  corkage?: number;
  /** Table asked for its server (ms) or not. */
  askedFor?: number;
  fireMode?: FireMode;
  fireTimerMin?: number;
  takenFrom?: string;
  takenAt?: number;
  source?: string;
  log?: OrderLogEvent[];
  [k: string]: unknown;
}

// ─── Associate meal program ──────────────────────────────────────────────

export interface AssocMeal {
  id: string;
  date: string;
  meal: MealName | 'NOC' | string;
  window: string;
  associate: string;
  item: string;
  status: string;
  note: string;
  log: unknown[];
  /** When the meal was marked ready for pickup (ms epoch). */
  readyAt?: number | null;
  mods?: Record<string, unknown>;
}

// ─── Notices ─────────────────────────────────────────────────────────────

export interface Broadcast {
  id: string;
  /** Community name, or "HO" for a home office notice. */
  scope: string;
  message: string;
  startDt: number;
  endDt: number;
  createdOn: number;
}

// ─── Resident notes ──────────────────────────────────────────────────────

/**
 * What a server noticed about a resident: "know" (good to know, hospitality
 * only), "obs" (an observation for the care team), "pref" (a dining
 * preference change) or "fb" (dining feedback for the culinary team).
 */
export type ResidentNoteKind = 'know' | 'obs' | 'pref' | 'fb';

export interface ResidentNote {
  id: string;
  kind: ResidentNoteKind;
  /** Resident id. */
  rid: string;
  text: string;
  at: number;
  /** Staff initials of who added it. */
  by?: string;
  /** Table label it was added at. */
  table?: string;
  edited?: boolean;
  [k: string]: unknown;
}
