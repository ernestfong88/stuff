/**
 * Back office navigation: sections and their pages. Page ids are also the
 * URL (#/backoffice/<pageId>) and the file name in ./pages.
 */
import type { ComponentType, LazyExoticComponent } from 'react';
import { lazy } from 'react';
import { LayoutGrid, BookOpen, ClipboardList, Store, Timer, Users, CreditCard, ShieldCheck, Building2, type LucideIcon } from 'lucide-react';

export interface BoPageDef {
  id: string;
  label: string;
  /** One line under the title, also used by search. */
  blurb: string;
  /** Extra words the Ctrl K search matches. */
  keywords: string;
  component: LazyExoticComponent<ComponentType<BoPageProps>>;
  /**
   * Pages opened from another page rather than the side nav name the nav
   * page they belong under; the nav highlights that page while they show.
   */
  parent?: string;
}

export interface BoSectionDef {
  id: string;
  label: string;
  icon: LucideIcon;
  pages: BoPageDef[];
}

/** Props every back office page receives. */
export interface BoPageProps {
  /** Go to another back office page, e.g. goto('chargeReview'). */
  goto: (pageId: string) => void;
}

export const BO_SECTIONS: BoSectionDef[] = [
  {
    id: 'today',
    label: 'Today',
    icon: LayoutGrid,
    pages: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        blurb: "Specials made and ordered, today's feedback, tomorrow's plan",
        keywords: 'home overview feedback specials counts tomorrow plan',
        component: lazy(() => import('./pages/dashboard')),
      },
      {
        id: 'pmix',
        label: 'P-Mix',
        blurb: 'What sells, by venue, meal and date range',
        keywords: 'sales mix popular report best sellers',
        component: lazy(() => import('./pages/pmix')),
      },
    ],
  },
  {
    id: 'menus',
    label: 'Menus & Recipes',
    icon: BookOpen,
    pages: [
      {
        id: 'recipes',
        label: 'Recipe Book',
        blurb: 'Your recipe master and the Global Library',
        keywords: 'dish item ingredient short name abbreviation sub type',
        component: lazy(() => import('./pages/recipes')),
      },
      {
        id: 'menus',
        label: 'Menu Cycle & À la Carte',
        blurb: 'Seasonal menus and when each venue starts one',
        keywords: 'cycle schedule season draft scheduled active archive',
        component: lazy(() => import('./pages/menus')),
      },
      {
        id: 'modifiers',
        label: 'Modifiers',
        blurb: 'Choices like cook temp, sides and dressing',
        keywords: 'options add-ons choices',
        component: lazy(() => import('./pages/modifiers')),
      },
      {
        id: 'export',
        label: 'Menu Export',
        blurb: 'Printable menus from marketing templates',
        keywords: 'pdf print template',
        component: lazy(() => import('./pages/export')),
      },
      {
        id: 'assoc',
        label: 'Associate Meals',
        blurb: 'Meals for staff by shift',
        keywords: 'staff employee associate',
        component: lazy(() => import('./pages/assoc')),
      },
    ],
  },
  {
    id: 'prodlists',
    label: 'Productions and Checklists',
    icon: ClipboardList,
    pages: [
      {
        id: 'production',
        label: 'Production',
        blurb: 'How many to make, with recommendations',
        keywords: 'prep forecast counts print sheets',
        component: lazy(() => import('./pages/production')),
      },
      {
        id: 'prepList',
        label: 'Prep Checklist',
        blurb: 'What Production Prep checks off at each meal, per venue',
        keywords: 'prep checklist deli line reach-in reach in cleaning opening closing side work task stocked backup',
        component: lazy(() => import('./pages/prepList')),
      },
      {
        id: 'swLib',
        label: 'Side Work Tasks',
        blurb: "Each venue's side work library",
        keywords: 'side work sidework task library opening mid closing breakfast lunch dinner minutes',
        component: lazy(() => import('./pages/swLib')),
      },
      {
        id: 'swAssign',
        label: 'Assign Side Work',
        blurb: "Today's side work for everyone on shift",
        keywords: 'side work sidework assign task shift today server roll silverware auto even',
        component: lazy(() => import('./pages/swAssign')),
      },
    ],
  },
  {
    id: 'venues',
    label: 'Venues',
    icon: Store,
    pages: [
      {
        id: 'venues',
        label: 'Venue Settings',
        blurb: 'Menus, printers, KDS screens and payment terminals per venue',
        keywords: 'printer terminal square room kds screen cook hot cold station',
        component: lazy(() => import('./pages/venues')),
      },
      {
        id: 'pricing',
        label: 'Pricing',
        blurb: 'Resident, guest and a la carte prices',
        keywords: 'price cost guest a la carte',
        component: lazy(() => import('./pages/pricing')),
      },
      {
        id: 'floorplan',
        label: 'Floor Plans',
        blurb: 'Arrange the tables in each room',
        keywords: 'tables layout seating map',
        component: lazy(() => import('./pages/floorplan')),
      },
      {
        id: 'svcRoute',
        label: 'Kitchen Routing',
        blurb: 'Cook line, expo or bar for each recipe',
        keywords: 'kds expo bar station route',
        component: lazy(() => import('./pages/svcRoute')),
      },
    ],
  },
  {
    id: 'service',
    label: 'Dining Service',
    icon: Timer,
    pages: [
      {
        id: 'svcFlow',
        label: 'Service Flow',
        blurb: 'Check-in, dessert and ordering steps',
        keywords: 'check in dessert steps workflow',
        component: lazy(() => import('./pages/svcFlow')),
      },
      {
        id: 'svcWin',
        label: 'Pick Up Windows',
        blurb: 'The 15 minute ranges each venue offers',
        keywords: 'pick up delivery window range time slot associate schedule cutoff',
        component: lazy(() => import('./pages/svcWin')),
      },
      {
        id: 'svcTexts',
        label: 'Text Messages',
        blurb: 'What residents and associates get by text',
        keywords: 'sms text message template wording mobile phone cell no mobile',
        component: lazy(() => import('./pages/svcTexts')),
      },
      {
        id: 'svcKiosk',
        label: 'Featured on Kiosk',
        blurb: 'The drinks and sides residents see first at the lobby kiosk',
        keywords: 'kiosk featured popular favorites drinks sides short list lobby order',
        component: lazy(() => import('./pages/svcKiosk')),
      },
      {
        id: 'broadcasts',
        label: 'Broadcasts',
        blurb: 'Notices servers open and acknowledge',
        keywords: 'message alert announcement notice acknowledge',
        component: lazy(() => import('./pages/broadcasts')),
      },
    ],
  },
  {
    id: 'residents',
    label: 'Residents',
    icon: Users,
    pages: [
      {
        id: 'resDiets',
        label: 'Allergies & Diets',
        blurb: 'Who has each allergy, diet or texture, as the kitchen ticket shows it',
        keywords: 'allergy allergies diet texture puree thickened gluten shellfish kds ticket report',
        component: lazy(() => import('./pages/resDiets')),
      },
      {
        id: 'resProfiles',
        label: 'Resident Profiles',
        blurb: 'The profile servers see when they open a resident',
        keywords: 'profile server view story family usuals preference',
        component: lazy(() => import('./pages/resProfiles')),
      },
      {
        id: 'trivia',
        label: 'Trivia Scoreboard',
        blurb: 'Monthly trivia points, winners and prizes',
        keywords: 'trivia quiz question game score scoreboard leaderboard prize winners engagement tv large print',
        component: lazy(() => import('./pages/trivia')),
      },
    ],
  },
  {
    id: 'billing',
    label: 'Billing',
    icon: CreditCard,
    pages: [
      {
        id: 'chargeReview',
        label: 'Charge Approval',
        blurb: 'Review and approve apartment charges',
        keywords: 'charges approve billing import void',
        component: lazy(() => import('./pages/chargeReview')),
      },
      {
        id: 'orders',
        label: 'Order History',
        blurb: 'Every check, with corrections',
        keywords: 'checks orders receipts',
        component: lazy(() => import('./pages/orders')),
      },
      {
        id: 'plans',
        label: 'Meal Plans',
        blurb: 'Plan types the charge engine uses, guest meal credits',
        keywords: 'plan monthly daily spend-down guest meal credit',
        component: lazy(() => import('./pages/plans')),
      },
      {
        id: 'mealdrops',
        label: 'Meal Counts',
        blurb: 'Options a server picks at close',
        keywords: 'guest associate count close',
        component: lazy(() => import('./pages/mealdrops')),
      },
      {
        id: 'fees',
        label: 'Delivery Options',
        blurb: 'Room service, tray and corkage fees, sick fee waivers',
        keywords: 'tray room service fee corkage wine bottle check charge sick waiver waive delivery fee',
        component: lazy(() => import('./pages/fees')),
      },
    ],
  },
  {
    id: 'admin',
    label: 'Associates & PINs',
    icon: ShieldCheck,
    pages: [
      {
        id: 'access',
        label: 'Associates & PINs',
        blurb: 'Everyone from ADP and their Culinary App PIN',
        keywords: 'associates staff employees adp pin reset login sign in windows access roles permissions users',
        component: lazy(() => import('./pages/access')),
      },
    ],
  },
  {
    id: 'ho',
    label: 'HO Settings',
    icon: Building2,
    pages: [
      {
        id: 'svcAlerts',
        label: 'Alerts & Timing',
        blurb: 'When tables and tickets turn red',
        keywords: 'red late timer threshold warning tables',
        component: lazy(() => import('./pages/svcAlerts')),
      },
      {
        id: 'svcMetrics',
        label: 'Shift Metrics',
        blurb: 'How a great shift is scored',
        keywords: 'great shift goals kpi scoring',
        component: lazy(() => import('./pages/svcMetrics')),
      },
      {
        id: 'credits',
        label: 'Meal Credits',
        blurb: 'What one meal credit covers, extras past it, and guest meals on a resident\'s credit',
        keywords: 'meal credit plan starter entree side dessert extra third side a la carte guest host allowance',
        component: lazy(() => import('./pages/credits')),
      },
    ],
  },
];

/** Pages opened from another page rather than the side nav (search still finds them). */
export const BO_MORE_PAGES: BoPageDef[] = [
  {
    id: 'residents',
    label: 'Dining Plans & Notes',
    blurb: 'Meal plan, preferences and kitchen notes',
    keywords: 'allergy diet meal plan billing start day hospice kitchen notes preferences',
    parent: 'resProfiles',
    component: lazy(() => import('./pages/residents')),
  },
  {
    id: 'svcRes',
    label: 'Conversation Profiles',
    blurb: 'Edit the story, Loves and Good to know notes servers see',
    keywords: 'story loves good to know conversation profile bio family interests edit',
    parent: 'resProfiles',
    component: lazy(() => import('./pages/svcRes')),
  },
];

export const BO_PAGES: BoPageDef[] = BO_SECTIONS.flatMap((s) => s.pages);

export const DEFAULT_BO_PAGE = 'dashboard';

export function findPage(id: string | undefined): { section: BoSectionDef; page: BoPageDef } | null {
  for (const section of BO_SECTIONS) {
    const page = section.pages.find((p) => p.id === id);
    if (page) return { section, page };
  }
  const more = BO_MORE_PAGES.find((p) => p.id === id);
  const home = more?.parent ? findPage(more.parent) : null;
  return more && home ? { section: home.section, page: more } : null;
}

/** The side nav page to highlight for a page: itself, or the page it was opened from. */
export function navPageId(id: string): string {
  return BO_MORE_PAGES.find((p) => p.id === id)?.parent ?? id;
}
