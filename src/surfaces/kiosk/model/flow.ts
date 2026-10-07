/**
 * The kiosk asks one question a screen. This is the order of the questions,
 * which ones a resident's answers let it skip, and how Back works.
 */
import type { MealName, QueueType, Resident } from '../../../domain/types';
import { getItem } from '../../../data';
import { isBuildYourOwn, type KioskMenu } from '../../../domain/kioskMenu';

/** The questions, in order. */
export const STEPS = ['apt', 'who', 'type', 'meal', 'time', 'entree', 'ver', 'side', 'soup', 'drink', 'dessert', 'notes', 'utensils', 'review'] as const;

export type Question = (typeof STEPS)[number];
export type Screen = 'welcome' | Question | 'done';

/** A side choice: keep what the dish comes with, none, or another side's item id. */
export type SideChoice = 'keep' | 'none' | string;

/** A list shown in full behind a More button. */
export type MoreList = 'times' | 'sides' | 'drinks' | 'alcohol';

export interface KioskState {
  step: Screen;
  /** How the resident finds themselves: last four digits of a phone, or apartment number. */
  by: 'phone' | 'apt';
  /** What they typed on the pad. */
  typed: string;
  /** Nobody matched what they typed. */
  miss: boolean;
  resident: Resident | null;
  type: QueueType | null;
  /** Delivery with the sick-tray fee waiver. */
  sick: boolean;
  meal: MealName | null;
  /** "YYYY-MM-DD" the meal is for. */
  date: string | null;
  /** Start of the booked range, minutes from midnight. */
  win: number | null;
  /** The time they picked filled up as they ordered. */
  filled: boolean;
  /** Which special is showing (one at a time). */
  special: number;
  /** Past the specials, on the full list. */
  others: boolean;
  entree: string | null;
  /** Ready-made version of a build-your-own dish. */
  version: string | null;
  side: SideChoice | null;
  /** Choosing a different side instead of the one it comes with. */
  pickSide: boolean;
  soup: string | null;
  drink: string | null;
  /** Past "Coffee again?", on the list. */
  drinkList: boolean;
  dessert: string | null;
  /** Past the special dessert, on the list. */
  moreDessert: boolean;
  /** Common changes picked as chips. */
  changes: string[];
  comment: string;
  /** Chips and comment as one note for the kitchen. */
  note: string;
  utensils: boolean | null;
  /** Answering the utensils question again instead of "like last time". */
  changeUtensils: boolean;
  /** "Text me a copy" (on unless turned off). */
  textCopy: boolean;
  /** Changing one answer from the review; come back to the review after. */
  edit: boolean;
  more: MoreList | null;
  placedId: string | null;
  sms: { to: string; body: string } | null;
  showSms: boolean;
}

export const INITIAL_STATE: KioskState = {
  step: 'welcome',
  by: 'phone',
  typed: '',
  miss: false,
  resident: null,
  type: null,
  sick: false,
  meal: null,
  date: null,
  win: null,
  filled: false,
  special: 0,
  others: false,
  entree: null,
  version: null,
  side: null,
  pickSide: false,
  soup: null,
  drink: null,
  drinkList: false,
  dessert: null,
  moreDessert: false,
  changes: [],
  comment: '',
  note: '',
  utensils: null,
  changeUtensils: false,
  textCopy: true,
  edit: false,
  more: null,
  placedId: null,
  sms: null,
  showSms: false,
};

/** Answers that start over when the meal (or its day) changes. */
export const MEAL_ANSWERS: Partial<KioskState> = {
  entree: null,
  side: null,
  soup: null,
  drink: null,
  dessert: null,
  version: null,
  special: 0,
  others: false,
  edit: false,
};

/** Whether a question doesn't apply to these answers. */
export function skips(step: Question, s: KioskState, menu: KioskMenu | null): boolean {
  if (step === 'ver') return !isBuildYourOwn(getItem(s.entree));
  if (step === 'side') return !s.entree;
  if (step === 'soup') return !menu?.soups.length;
  if (step === 'dessert') return !menu?.desserts.length;
  return false;
}

/**
 * The next question after the current one. While changing one answer from
 * the review, it goes straight back to the review, except after the
 * answers that lead on to more questions (the order type, the meal, a new
 * main dish and its version).
 */
export function nextStep(s: KioskState, menu: KioskMenu | null): Screen {
  const i = STEPS.indexOf(s.step as Question);
  let next: Screen = 'review';
  for (let j = i + 1; j < STEPS.length; j++) {
    if (!skips(STEPS[j], s, menu)) {
      next = STEPS[j];
      break;
    }
  }
  const leadsOn = s.step === 'type' || s.step === 'meal' || (s.step === 'entree' && !!s.entree) || s.step === 'ver';
  return s.edit && !leadsOn ? 'review' : next;
}

/**
 * The questions counted in "Step 3 of 12". Before the meal is known nothing
 * is skipped; the side question still counts until the main dish is past.
 */
export function countedSteps(s: KioskState, menu: KioskMenu | null): Question[] {
  const at = STEPS.indexOf(s.step as Question);
  return STEPS.filter((k) => !(s.meal && skips(k, s, menu)) || (k === 'side' && at < STEPS.indexOf('side')));
}

/**
 * What Back does inside a screen before going to the previous one: close a
 * More list, or return from a list to the question it came from ("Coffee
 * again?", "Your meal comes with ...", the special dessert). Returns a
 * patch, or null when Back should go to the previous screen.
 */
export function backWithin(s: KioskState): Partial<KioskState> | null {
  if (s.more) return { more: null };
  if (s.edit) return null;
  if (s.step === 'drink' && s.drinkList) return { drinkList: false };
  if (s.step === 'utensils' && s.changeUtensils) return { changeUtensils: false };
  if (s.step === 'side' && s.pickSide) return { pickSide: false };
  if (s.step === 'dessert' && s.moreDessert) return { moreDessert: false };
  return null;
}
