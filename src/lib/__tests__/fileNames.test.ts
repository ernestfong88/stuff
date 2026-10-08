import { readdirSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', '..');
const CODE = new Set(['.ts', '.tsx', '.js', '.jsx']);

/** Every source module, as it would be imported: path without the code extension. */
function modules(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) modules(path, out);
    else if (CODE.has(extname(name))) out.push(relative(SRC, path).slice(0, -extname(name).length));
  }
  return out;
}

describe('file names', () => {
  // Windows and macOS ignore letter case, so "ProfileFilters.tsx" and "profileFilters.ts" are the same import there.
  it('has no two modules that differ only in letter case', () => {
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const m of modules(SRC)) {
      const key = m.toLowerCase();
      const other = seen.get(key);
      if (other && other !== m) clashes.push(`${other} / ${m}`);
      seen.set(key, m);
    }
    expect(clashes).toEqual([]);
  });
});
