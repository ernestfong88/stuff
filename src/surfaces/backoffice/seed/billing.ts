/**
 * Back office billing lists and the charges waiting for approval, extracted
 * from the prototype. Charge dates are stored as days from today so the
 * demo always shows a fresh queue.
 */
import { startOfToday, DAY, HOUR } from '../../../lib/clock';
import billingJson from './billing.json';

/** How the charge engine counts a plan: meals a month, meals a day, or a dollar spend-down. */
export type PlanType = 'Monthly' | 'Daily' | 'Monthly $';

export interface BoMealPlan {
  id: string;
  text: string;
  amt: number;
  type: PlanType;
  /** The old single "default" tick. Care-level defaults (`defaultPlans` in the billing store) replace it; still read to carry saved copies over. */
  isDefault: boolean;
  /** Retired plans stay for old records but are hidden. */
  active: boolean;
}

/** Who a meal count option applies to. */
export type MealCountFor = 0 | 1 | 2;
export const MEAL_COUNT_FOR: Record<MealCountFor, string> = { 0: 'Resident', 1: 'Guest', 2: 'Associate' };

/** An option a server picks when closing a check. */
export interface MealCountOption {
  id: string;
  text: string;
  /** Meals it uses from the plan. */
  count: number;
  /** Charge in dollars, 0 for none. */
  amt: number;
  isGuest: MealCountFor;
  isDefault: boolean;
  active: boolean;
}

export interface DeliveryOption {
  id: string;
  text: string;
  amt: number;
  isDefault: boolean;
  active: boolean;
}

/** Billing item codes that show as a tag on each charge. */
export type ChargeItem = 'TRAY' | 'LIQUOR' | 'GMEAL' | 'MEAL' | 'MANUAL' | string;

export interface Charge {
  id: string;
  residentId: string;
  level: string;
  /** When the charge was made (ms). */
  date: number;
  item: ChargeItem;
  desc: string;
  amount: number;
  /** Voided charges are inactive; voiding can be undone. */
  active: boolean;
  approvedAt: number | null;
  approvedBy: string | null;
  importedAt: number | null;
  source: 'delivery' | 'item' | 'meal' | 'manual' | string;
  /** Floor charges: the amount the check last had ("none" once comped or paid another way), so a later correction can be followed. */
  floorSig?: string;
}

interface SeedCharge extends Omit<Charge, 'date' | 'approvedAt' | 'importedAt'> {
  day: number;
  approvedDay: number | null;
  importedDay: number | null;
}

const seed = billingJson as unknown as {
  plans: BoMealPlan[];
  mealCounts: MealCountOption[];
  deliveryOptions: DeliveryOption[];
  charges: SeedCharge[];
};

/** A day offset as a time that day (charges post mid-morning). */
const onDay = (day: number | null) => (day == null ? null : startOfToday() + day * DAY + 10 * HOUR);

export const seedPlans = (): BoMealPlan[] => seed.plans.map((p) => ({ ...p }));
/** The plan each care level starts on: IL on the 30 meal plan, AL on 2 meals a day (the tablets' daily2). */
export const seedDefaultPlans = (): Record<string, string> => ({ IL: 'pl1', AL: 'pl8' });
export const seedMealCounts = (): MealCountOption[] => seed.mealCounts.map((m) => ({ ...m }));
export const seedDeliveryOptions = (): DeliveryOption[] => seed.deliveryOptions.map((d) => ({ ...d }));
export const seedCharges = (): Charge[] =>
  seed.charges.map(({ day, approvedDay, importedDay, ...c }) => ({
    ...c,
    date: onDay(day) ?? startOfToday(),
    approvedAt: onDay(approvedDay),
    importedAt: onDay(importedDay),
  }));
