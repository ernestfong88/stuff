import { MINUTE, now } from './clock';

/** "6:05 PM" */
export function formatTime(ts: number | Date | null | undefined): string {
  if (ts == null) return '';
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/** Minutes after midnight → "5:00 PM"; past midnight wraps (1560 → "2:00 AM"). */
export function formatMinuteOfDay(v: number): string {
  const h = Math.floor(v / 60) % 24;
  return `${h % 12 || 12}:${String(v % 60).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** "Wednesday, Oct 7" */
export function formatDayLong(ts: number | Date): string {
  return new Date(ts).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

/** "Wed, Oct 7" */
export function formatDayShort(ts: number | Date): string {
  return new Date(ts).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/** "$12.00" */
export function formatMoney(amount: number | null | undefined): string {
  return '$' + (Number(amount) || 0).toFixed(2);
}

/** "$12" when whole, "$12.50" otherwise. */
export function formatMoneyShort(amount: number | null | undefined): string {
  const n = Number(amount) || 0;
  return '$' + (Number.isInteger(n) ? n.toString() : n.toFixed(2));
}

/** Ticket timer: "4:02" (m:ss) or "1:04:10" past an hour. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** "just now", "4m ago", "2h 5m ago" */
export function formatAgo(ts: number | null | undefined): string {
  if (!ts) return '';
  const mins = Math.floor((now() - ts) / MINUTE);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  return `${h}h ${mins % 60}m ago`;
}

/** "Marty Martin" -> "MM" */
export function initials(name: string | null | undefined): string {
  return (name || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/** "Marty Martin" -> "Marty" */
export function firstName(name: string | null | undefined): string {
  return (name || '').split(/\s+/)[0] || '';
}

/** 1 -> "1st", 22 -> "22nd" */
export function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] || 'th';
  return n + s;
}

export function plural(n: number, one: string, many = one + 's'): string {
  return `${n} ${n === 1 ? one : many}`;
}
