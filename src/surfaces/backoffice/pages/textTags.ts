/**
 * Helpers for writing a text's wording: which {tags} a text can't fill in,
 * and adding a tag where the cursor is.
 */

/** Tags in the wording that this text can't fill in, each once: residents would get them as typed. */
export function unknownTags(body: string, allowed: readonly string[]): string[] {
  const found = [...body.matchAll(/\{(\w*)\}/g)].map((m) => m[1]);
  return [...new Set(found.filter((t) => !allowed.includes(t)))];
}

/** Put "{tag}" at the cursor (replacing any selection), with a space either side where it needs one. */
export function insertTag(body: string, tag: string, start = body.length, end = start): { body: string; cursor: number } {
  const before = body.slice(0, start);
  const after = body.slice(end);
  const lead = before && !/\s$/.test(before) ? ' ' : '';
  const trail = after && !/^[\s.,!?;:]/.test(after) ? ' ' : '';
  const piece = `${lead}{${tag}}${trail}`;
  return { body: before + piece + after, cursor: before.length + piece.length };
}
