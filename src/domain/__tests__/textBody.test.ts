import { describe, expect, it } from 'vitest';
import { TEXT_DEFINITIONS, textBody } from '../pickupService/texts';

describe('message wording', () => {
  const standard = TEXT_DEFINITIONS.find((d) => d.key === 'pickupReady')!.body;
  it('uses the community wording, and falls back to the standard when it was saved blank', () => {
    expect(textBody({ pickupReady: { body: 'Ready, {name}!' } }, 'pickupReady')).toBe('Ready, {name}!');
    expect(textBody({ pickupReady: { body: '   ' } }, 'pickupReady')).toBe(standard);
    expect(textBody({}, 'pickupReady')).toBe(standard);
  });
});
