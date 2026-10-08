/**
 * Back office navigation: sections and their pages. Page ids are also the
 * URL (#/backoffice/<pageId>) and the file name in ./pages.
 */
import type { ComponentType, LazyExoticComponent } from 'react';
import { lazy } from 'react';
import { LayoutGrid, MonitorPlay, BookOpen, ClipboardList, Store, Timer, Users, CreditCard, ShieldCheck, Building2, TabletSmartphone, type LucideIcon } from 'lucide-react';

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
  /** Release phase; absent means Phase 1. HO Settings -> Release Phases can move it. */
  phase?: 1 | 2 | 3;
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
        phase: 3,
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
        phase: 3,
        component: lazy(() => import('./pages/production')),
      },
      {
        id: 'prepList',
        label: 'Prep Checklist',
        blurb: 'What Production Prep checks off at each meal, per venue',
        keywords: 'prep checklist deli line reach-in reach in stocking opening side work task stocked backup',
        phase: 3,
        component: lazy(() => import('./pages/prepList')),
      },
      {
        id: 'cleaningLog',
        label: 'Cleaning Log',
        blurb: 'Daily and weekly cleaning, assigned and signed off with a PIN',
        keywords: 'cleaning log sanitize sanitation weekly daily opening closing hood filters delime walk-in sign off pin assign cook',
        phase: 3,
        component: lazy(() => import('./pages/cleaningLog')),
      },
      {
        id: 'tempLog',
        label: 'Temperature Log',
        blurb: 'Food temperatures at every meal, signed off with a PIN',
        keywords: 'temperature temp log food safety haccp hot hold cold hold probe thermometer reheat 165 135 41 corrective action health inspector',
        phase: 3,
        component: lazy(() => import('./pages/tempLog')),
      },
      {
        id: 'swLib',
        label: 'Side Work Tasks',
        blurb: "Each venue's side work library",
        keywords: 'side work sidework task library opening mid closing breakfast lunch dinner minutes',
        phase: 3,
        component: lazy(() => import('./pages/swLib')),
      },
      {
        id: 'swAssign',
        label: 'Assign Side Work',
        blurb: "Today's side work for everyone on shift",
        keywords: 'side work sidework assign task shift today server roll silverware auto even',
        phase: 3,
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
        blurb: "Each venue's menu, prices, floor plan, kitchen routing, printers and terminals",
        keywords:
          'printer terminal square room price pricing cost guest a la carte floor plan tables layout seating map kitchen routing bar route tickets',
        component: lazy(() => import('./pages/venues')),
      },
      {
        id: 'printers',
        label: 'Printers',
        blurb: 'Add, rename and remove printers, and choose what each one prints, down to single menu items',
        keywords: 'printer ticket kitchen print route receipt label ip test menu item send to',
        phase: 1,
        component: lazy(() => import('./pages/printers')),
      },
    ],
  },
  {
    id: 'kds',
    label: 'KDS',
    icon: MonitorPlay,
    pages: [
      {
        id: 'kds',
        label: 'KDS Settings',
        blurb: "Each kitchen's cook screens and expo screen",
        keywords: 'kds kitchen display screen cook hot cold station expo subcategory bump',
        // Kitchens start on printed tickets; screens come in Phase 2.
        phase: 2,
        component: lazy(() => import('./pages/kds')),
      },
    ],
  },
  {
    id: 'service',
    label: 'POS Settings',
    icon: Timer,
    pages: [
      {
        id: 'svcFlow',
        label: 'Pacing & Coursing',
        blurb: 'Coursing, check-ins, dessert and ordering steps',
        keywords: 'service flow pacing fire course check in dessert steps workflow coursing hospice comp',
        component: lazy(() => import('./pages/svcFlow')),
      },
      {
        id: 'svcWin',
        label: 'Pick Up & Delivery',
        blurb: 'Pick up times, delivery fees and sick fee waivers',
        keywords: 'pick up delivery window range time slot associate schedule cutoff tray room service fee sick waiver waive',
        component: lazy(() => import('./pages/svcWin')),
      },
      {
        id: 'svcTexts',
        label: 'Messages',
        blurb: 'Texts to residents and broadcasts to staff',
        keywords: 'sms text message template wording mobile phone cell no mobile broadcast alert announcement notice acknowledge',
        component: lazy(() => import('./pages/svcTexts')),
      },
    ],
  },
  {
    id: 'kiosk',
    label: 'Kiosk',
    icon: TabletSmartphone,
    pages: [
      {
        id: 'svcKiosk',
        label: 'Kiosk Settings',
        blurb: 'The drinks and sides residents see first at the lobby kiosk',
        keywords: 'kiosk featured popular favorites drinks sides short list lobby order rotate screen',
        phase: 3,
        component: lazy(() => import('./pages/svcKiosk')),
      },
    ],
  },
  {
    id: 'residents',
    label: 'Resident Dining Profile',
    icon: Users,
    pages: [
      {
        id: 'resProfiles',
        label: 'Resident Dining Profile',
        blurb: 'Care level, meal plan, allergies and diets for every resident, with filters; trivia',
        keywords:
          'residents resident profiles dining profile server view story family usuals preference allergy allergies diet diets texture puree thickened gluten shellfish care level il al independent assisted meal plan a la carte filter trivia quiz score scoreboard prize',
        component: lazy(() => import('./pages/resProfiles')),
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
        blurb: 'Meal plans, meal counts and corkage',
        keywords: 'plan monthly daily spend-down meal counts guest associate close corkage wine bottle',
        component: lazy(() => import('./pages/plans')),
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
      {
        id: 'phases',
        label: 'Release Phases',
        blurb: 'Which back office pages ship in Phase 1 and which come later',
        keywords: 'phase 1 2 release rollout launch later roadmap scope mvp',
        component: lazy(() => import('./pages/phases')),
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

/**
 * Pages that were merged into another page's tab. Their old addresses (and
 * links inside the app) still work: they open the tab they became, and
 * search still finds them by their old name.
 */
export interface BoPageAlias {
  id: string;
  label: string;
  blurb: string;
  keywords: string;
  /** Where it lives now, as #/backoffice/<...to>. */
  to: string[];
}

export const BO_ALIASES: BoPageAlias[] = [
  { id: 'pricing', label: 'Prices', blurb: 'In Venue Settings, on each venue', keywords: 'pricing price cost guest a la carte', to: ['venues', 'first', 'prices'] },
  { id: 'floorplan', label: 'Floor plan', blurb: 'In Venue Settings, on each venue', keywords: 'floor plans tables layout seating map', to: ['venues', 'first', 'floor'] },
  { id: 'svcRoute', label: 'Kitchen routing', blurb: 'In Venue Settings, on each venue', keywords: 'kitchen routing kds expo bar station route', to: ['venues', 'first', 'kitchen'] },
  { id: 'fees', label: 'Delivery fees & sick waivers', blurb: 'In Pick Up & Delivery', keywords: 'delivery options tray room service fee sick waiver', to: ['svcWin', 'fees'] },
  { id: 'broadcasts', label: 'Broadcasts to staff', blurb: 'In Messages', keywords: 'broadcast notice announcement', to: ['svcTexts', 'broadcasts'] },
  { id: 'resDiets', label: 'Allergies & diets', blurb: 'Filters in Resident Dining Profile', keywords: 'allergy diet texture', to: ['resProfiles'] },
  { id: 'trivia', label: 'Trivia scoreboard', blurb: 'In Resident Dining Profile', keywords: 'trivia quiz score prize', to: ['resProfiles', 'trivia'] },
  { id: 'mealdrops', label: 'Meal counts', blurb: 'In Meal Plans', keywords: 'meal counts guest associate close', to: ['plans', 'counts'] },
  { id: 'corkage', label: 'Corkage', blurb: 'In Meal Plans', keywords: 'corkage wine bottle fee', to: ['plans', 'corkage'] },
];

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
