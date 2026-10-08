/**
 * Checks for the devices set up in Back Office: printer IP addresses and
 * card terminal pairing codes.
 */

/** A dotted IPv4 address, four numbers 0 to 255 ("10.1.20.12"). */
export function isIPv4(ip: string): boolean {
  const parts = ip.trim().split('.');
  return parts.length === 4 && parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255 && (p === '0' || !p.startsWith('0')));
}

/**
 * What is wrong with a printer IP, or null when it is fine: blank, not an
 * IPv4 address, or already used by another printer (`selfId` is the printer
 * being edited, which may keep its own address).
 */
export function printerIpProblem(ip: string, printers: ReadonlyArray<{ id: string; name: string; ip: string }>, selfId?: string): string | null {
  const v = ip.trim();
  if (!v) return 'Enter the printer’s IP address.';
  if (!isIPv4(v)) return `“${v}” isn’t an IP address. Use four numbers from 0 to 255, like 10.1.20.15.`;
  const other = printers.find((p) => p.id !== selfId && p.ip.trim() === v);
  return other ? `${other.name} already uses ${v}.` : null;
}

/** A terminal pairing code: the 6 letters and digits the terminal shows (spaces and dashes ignored). */
export function cleanPairingCode(code: string): string | null {
  const c = code.replace(/[\s-]/g, '').toUpperCase();
  return /^[A-Z0-9]{6}$/.test(c) ? c : null;
}
