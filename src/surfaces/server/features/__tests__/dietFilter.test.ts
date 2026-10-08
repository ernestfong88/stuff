import { describe, expect, it } from 'vitest';
import type { Resident } from '../../../../domain/types';
import { ANY_ALLERGY, dietIndex, dietSummary, isFiltering, matchesDiet, NO_DIET_FILTER, toggleDietKey, toggleSpecial } from '../residents/dietFilter';

const person = (id: string, more: Partial<Resident> = {}): Resident => ({ id, name: id, apt: '100', level: 'IL', ...more }) as Resident;

const list = [
  person('ann', { allergies: ['Shellfish'], diet: ['Gluten Free'] }),
  person('bob', { diet: ['Diabetic'] }),
  person('cal', { foodPrep: 'Puree' }),
  person('dee'),
];
const index = dietIndex(list);
const shown = (f: Parameters<typeof matchesDiet>[1]) => list.filter((r) => matchesDiet(index.get(r.id), f)).map((r) => r.id);

describe('special diets at a glance', () => {
  it('counts residents with any tag, with an allergy, and per tag', () => {
    const sum = dietSummary(index);
    expect(sum.special).toBe(3);
    expect(sum.allergies).toBe(1);
    // Allergies lead the tag list.
    expect(sum.tags[0]).toMatchObject({ cat: 'allergy', n: 1 });
    expect(sum.tags.reduce((n, t) => n + t.n, 0)).toBe(4);
  });

  it('shows everyone with no filter, and only tagged residents with Special diets on', () => {
    expect(isFiltering(NO_DIET_FILTER)).toBe(false);
    expect(shown(NO_DIET_FILTER)).toEqual(['ann', 'bob', 'cal', 'dee']);
    expect(shown(toggleSpecial(NO_DIET_FILTER))).toEqual(['ann', 'bob', 'cal']);
  });

  it('a tag chip shows the residents carrying it, several chips any of them', () => {
    const tags = dietSummary(index).tags;
    const diab = tags.find((t) => /diab/i.test(t.text))!;
    const puree = tags.find((t) => t.cat === 'texture')!;
    const one = toggleDietKey(NO_DIET_FILTER, diab.key);
    expect(one.special).toBe(true);
    expect(shown(one)).toEqual(['bob']);
    expect(shown(toggleDietKey(one, puree.key))).toEqual(['bob', 'cal']);
    // Tapping it again takes it off.
    expect(toggleDietKey(one, diab.key).keys).toEqual([]);
  });

  it('"Allergies" matches any allergy, and turning Special diets off clears the picks', () => {
    const f = toggleDietKey(NO_DIET_FILTER, ANY_ALLERGY);
    expect(shown(f)).toEqual(['ann']);
    expect(toggleSpecial(f)).toEqual(NO_DIET_FILTER);
  });
});
