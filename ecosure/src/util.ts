export const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const slug = (s: string): string =>
  s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Letters and digits only, for fuzzy text matching. */
export const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '');

const MON: Record<string, string> = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };

/** Accepts MM/DD/YYYY, YYYY-MM-DD, Mon-DD-YYYY and returns YYYY-MM-DD ('' if unreadable). */
export function isoDate(s: string | null | undefined): string {
  if (!s) return '';
  const t = s.trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  m = t.match(/^([A-Za-z]{3})[a-z]*[- ](\d{1,2}),?[- ](\d{4})/);
  if (m && MON[m[1].toLowerCase()]) return `${m[3]}-${MON[m[1].toLowerCase()]}-${m[2].padStart(2, '0')}`;
  return '';
}

export const todayIso = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
}

export function addDays(a: string, n: number): string {
  return new Date(Date.parse(a + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
}

const MSHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "Sep 22, 2026" (or "Sep 22" when short). */
export function fmtDate(iso: string, short = false): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return short ? `${MSHORT[m - 1]} ${d}` : `${MSHORT[m - 1]} ${d}, ${y}`;
}

export const pct = (n: number | null | undefined): string => (n == null || Number.isNaN(n) ? 'Pending' : String(Math.round(n)));

export function avg(ns: (number | null | undefined)[]): number | null {
  const v = ns.filter((n): n is number => typeof n === 'number');
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

export function groupBy<T, K extends string>(xs: T[], f: (x: T) => K): Record<K, T[]> {
  const out = {} as Record<K, T[]>;
  for (const x of xs) (out[f(x)] ||= []).push(x);
  return out;
}

export function countBy<T>(xs: T[], f: (x: T) => string): Map<string, number> {
  const m = new Map<string, number>();
  for (const x of xs) m.set(f(x), (m.get(f(x)) ?? 0) + 1);
  return m;
}

/** Split "Balfour Louisville - Kitchen #2" into community and kitchen. */
export function splitUnit(unit: string): { community: string; kitchen: string | null } {
  const u = unit.replace(/\s+/g, ' ').trim();
  const m = u.match(/^(.*?)\s*-\s*Kitchen\s*#?\s*(\d+)$/i);
  return m ? { community: m[1].trim(), kitchen: 'Kitchen ' + m[2] } : { community: u, kitchen: null };
}

export function csv(rows: (string | number | null | undefined)[][]): string {
  return rows
    .map((r) => r.map((v) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(','))
    .join('\n');
}

export const plural = (n: number, one: string, many = one + 's'): string => `${n} ${n === 1 ? one : many}`;
