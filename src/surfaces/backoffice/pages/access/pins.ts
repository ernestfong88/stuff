/**
 * Culinary App PINs for associates without a Windows login. Resetting makes
 * a new PIN at once; the old one stops working.
 */
import { staff } from '../../../../data';
import type { AdpAssociate } from '../../seed/associates';

export { setPin, usePinOverrides } from '../../../../store/pins';

/** The associate's PIN now: a reset one, else the dining roster's (tablet users), else ADP's. */
export function currentPin(a: AdpAssociate, overrides: Record<string, string>): string | undefined {
  if (a.win) return undefined;
  return overrides[a.id] ?? (a.tab ? staff.find((s) => s.id === a.id)?.pin : undefined) ?? a.pin;
}

/** A PIN nobody could guess at a glance: no 1111, no 1234 or 4321. */
export function isGuessable(pin: string): boolean {
  return /^(\d)\1{3}$/.test(pin) || '0123456789'.includes(pin) || '9876543210'.includes(pin);
}

/** A new 4 digit PIN that no one else has and that is not guessable. */
export function newPin(inUse: Set<string>, random: () => number = Math.random): string {
  for (;;) {
    const pin = String(Math.floor(1000 + random() * 9000));
    if (!inUse.has(pin) && !isGuessable(pin)) return pin;
  }
}

export type SignIn = 'all' | 'pin' | 'win';
export type AssociateSortKey = 'name' | 'title' | 'how' | 'added';

const sortValue: Record<AssociateSortKey, (a: AdpAssociate) => string> = {
  name: (a) => a.name.toLowerCase(),
  title: (a) => a.title.toLowerCase(),
  how: (a) => (a.win ? '0' : '1') + a.name.toLowerCase(),
  added: (a) => String(a.days).padStart(6, '0'),
};

export function filterAssociates(list: AdpAssociate[], f: { query: string; how: SignIn; sort: { key: AssociateSortKey; dir: 1 | -1 } }): AdpAssociate[] {
  const q = f.query.trim().toLowerCase();
  return list
    .filter((a) => (f.how === 'all' || (f.how === 'win' ? !!a.win : !a.win)) && (!q || [a.name, a.title, a.dept, a.emp, a.win ?? ''].join(' ').toLowerCase().includes(q)))
    .sort((a, b) => {
      const A = sortValue[f.sort.key](a);
      const B = sortValue[f.sort.key](b);
      return (A < B ? -1 : A > B ? 1 : 0) * f.sort.dir || a.name.localeCompare(b.name);
    });
}

/** "Today", "5 days ago", or the date for anything older than a month. */
export function addedText(days: number, at: number): string {
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days <= 30) return `${days} days ago`;
  return new Date(at - days * 86_400_000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
