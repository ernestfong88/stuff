import { describe, expect, it } from 'vitest';
import { diner } from '../../../../domain/__tests__/helpers';
import { dinerPerson } from '../../../../domain/orders';
import { allergyPerson } from '../diners/allergyPerson';

describe('allergyPerson', () => {
  it('is the resident for a resident diner', () => {
    const d = diner([]);
    expect(allergyPerson(d)).toBe(dinerPerson(d));
    expect(allergyPerson(d)).toBeDefined();
  });

  it("never carries the host's allergies onto a guest", () => {
    const guest = diner([], { isGuest: true, guestName: 'Carol' });
    expect(dinerPerson(guest)).toBeDefined();
    expect(allergyPerson(guest)).toBeUndefined();
  });
});
