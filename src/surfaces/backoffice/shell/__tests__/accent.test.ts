import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BO_SECTIONS } from '../../nav';

const tokens = readFileSync(join(__dirname, '..', '..', '..', '..', 'styles', 'tokens.css'), 'utf8');

/** The colours each back office section is given in tokens.css. */
function accentRule(sectionId: string): string | undefined {
  const at = tokens.indexOf(`[data-bo-section='${sectionId}']`);
  if (at < 0) return undefined;
  return tokens.slice(at, tokens.indexOf('}', at));
}

describe('section accent colours', () => {
  it('gives every side menu section its accent, soft tint and ink', () => {
    for (const sec of BO_SECTIONS) {
      const rule = accentRule(sec.id);
      expect(rule, sec.id).toBeDefined();
      for (const v of ['--bo-accent:', '--bo-accent-soft:', '--bo-accent-ink:']) expect(rule, `${sec.id} ${v}`).toContain(v);
    }
  });
});
