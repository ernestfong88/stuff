/** What is wrong with a venue name, or null: it can't be blank or match another venue's (retired ones too, case aside). */
export function venueNameProblem(name: string, venues: ReadonlyArray<{ id: string; name: string; active?: boolean }>, selfId?: string): string | null {
  const n = name.trim();
  if (!n) return 'A venue needs a name.';
  const other = venues.find((v) => v.id !== selfId && v.name.trim().toLowerCase() === n.toLowerCase());
  if (!other) return null;
  return other.active === false ? `${other.name} is a retired venue. Pick another name, or bring it back.` : `There's already a venue called ${other.name}.`;
}
