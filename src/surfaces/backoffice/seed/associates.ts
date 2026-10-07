/**
 * Everyone at the community in ADP (the HR system), as the back office's
 * Associates & PINs page lists them. Extracted from the prototype (__K_ADP).
 * Accounts come from the ADP feed; associates without a Windows login sign
 * in to the Culinary App with a PIN.
 */
import { COMMUNITY_NAME } from '../../../data';
import associatesJson from './associates.json';

export interface AdpAssociate {
  /** Initials, also the staff id for associates who use the dining tablets. */
  id: string;
  name: string;
  title: string;
  dept: string;
  /** ADP employee number. */
  emp: string;
  /** Windows login; associates without one sign in with a PIN. */
  win?: string;
  /** Culinary App PIN (absent for Windows sign-in). */
  pin?: string;
  /** Days since the account came over from ADP. */
  days: number;
  /** Signs in on the dining tablets, so the dining roster holds the live PIN. */
  tab?: number;
}

export const ADP_ASSOCIATES = associatesJson as AdpAssociate[];

/** Who is using the back office. It has no PIN sign-in; the account comes from Windows. */
export const BACK_OFFICE_USER = {
  initials: 'EF',
  name: 'Ernest Fong',
  /** Short form for "approved by" stamps. */
  short: 'E. Fong',
  role: 'Culinary Director · Author',
  home: COMMUNITY_NAME,
  departments: ['Culinary'],
} as const;
