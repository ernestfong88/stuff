/** Short random id with a prefix, e.g. uid('li') -> "li7k2m9x". */
export function uid(prefix = ''): string {
  return prefix + Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 7);
}
