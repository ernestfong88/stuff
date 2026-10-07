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

export type KitchenState = 'scheduled' | 'cooking' | 'ready' | 'cleared' | 'bar' | 'pour' | null;

export interface OrderLine {
  id: string;
  itemId: string;
  mods: Record<string, string | string[]>;
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
  comped?: boolean;
  hold?: boolean;
  holdAt?: number | null;
  drink?: boolean;
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
  deliveryFeeId?: string;
  sentAt?: number;
  drinksAt?: number;
  fireAtTs?: number;
  readyStampAt?: number | null;
  notified?: boolean;
  notifiedAt?: number;
  deliveredAt?: number;
  checkIns?: CheckIn[];
  noDessert?: boolean;
  sickTray?: unknown;
  assoc?: boolean;
  assocName?: string;
  hostSeated?: boolean;
  greetedAt?: number;
  closedAt?: number;
  closedBy?: string;
  comp?: unknown;
  feeComped?: boolean;
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
