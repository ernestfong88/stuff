import { describe, expect, it } from 'vitest';
import { venueNameProblem } from '../venues/venueName';

describe('venue names', () => {
  const venues = [
    { id: 'v1', name: 'Sequoia Dining Room', active: true },
    { id: 'v2', name: 'Evergreen Dining Room', active: true },
    { id: 'v3', name: 'Old Cafe', active: false },
  ];
  it('refuses a blank or duplicate name, ignoring case and spaces', () => {
    expect(venueNameProblem('  ', venues)).toBe('A venue needs a name.');
    expect(venueNameProblem(' evergreen dining room', venues, 'v1')).toBe("There's already a venue called Evergreen Dining Room.");
    expect(venueNameProblem('Old Cafe', venues)).toMatch(/retired/);
  });
  it('lets a venue keep its own name and take a new one', () => {
    expect(venueNameProblem('Sequoia Dining Room', venues, 'v1')).toBeNull();
    expect(venueNameProblem('Garden Room', venues)).toBeNull();
  });
});
