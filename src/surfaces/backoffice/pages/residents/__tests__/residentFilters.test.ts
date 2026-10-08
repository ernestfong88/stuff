import { describe, expect, it } from 'vitest';
import { residents } from '../../../../../data';
import type { Resident } from '../../../../../domain/types';
import { seedBoResidents } from '../../../seed/residents';
import { seedPlans } from '../../../seed/billing';
import {
  A_LA_CARTE,
  NO_FILTER,
  anyOf,
  filterProfiles,
  isFiltered,
  planBucket,
  profileFacets,
  profileRows,
  unlistedAllergens,
} from '../residentFilters';

const plans = seedPlans();
const records = seedBoResidents();
const rows = profileRows(residents, (r) => planBucket(records.find((x) => x.id === r.id && x.name === r.name)?.planId, plans));
const names = (list: typeof rows) => list.map((x) => x.r.name);

describe('planBucket', () => {
  it('is the Back Office plan, with a $0 plan or none at all counted as à la carte', () => {
    expect(planBucket('pl1', plans)).toEqual({ id: 'pl1', label: 'IL Resident Meal Plan' });
    expect(planBucket('pl4', plans)).toBe(A_LA_CARTE);
    expect(planBucket('gone', plans)).toBe(A_LA_CARTE);
    expect(planBucket(undefined, plans)).toBe(A_LA_CARTE);
  });
});

describe('profile facets', () => {
  it('counts care levels, tags, categories and plans across everyone', () => {
    const f = profileFacets(rows, NO_FILTER);
    expect(f.levels).toEqual([
      { id: 'IL', label: 'IL', n: 17 },
      { id: 'AL', label: 'AL', n: 8 },
    ]);
    expect(f.tags[0].cat).toBe('allergy');
    expect(f.tags.find((t) => t.key === 'allergy|Shellfish')?.n).toBe(1);
    expect(f.tags.find((t) => t.key === 'diet|GF')?.n).toBe(2);
    // Rose, Walter, Joan (peanuts), Mildred, Beatrice.
    expect(f.categories).toEqual({ allergy: 5, diet: 5, texture: 2 });
    expect(f.none).toBe(17);
    expect(f.plans.map((p) => [p.label, p.n])).toEqual([
      ['IL Resident Meal Plan', 21],
      ['À la carte', 2],
      ['AL 2x Meals a Day', 2],
    ]);
  });

  it('counts each filter with the others applied, and keeps every choice listed', () => {
    const f = profileFacets(rows, { ...NO_FILTER, level: 'IL' });
    // The level's own counts ignore the level picked.
    expect(f.levels.map((l) => l.n)).toEqual([17, 8]);
    expect(f.categories.allergy).toBe(1);
    expect(f.tags.find((t) => t.key === 'allergy|Gluten')?.n).toBe(0);
    expect(f.plans.find((p) => p.id === 'pl8')?.n).toBe(0);
    const gf = profileFacets(rows, { ...NO_FILTER, tags: ['diet|GF'] });
    expect(gf.levels.map((l) => l.n)).toEqual([0, 2]);
    expect(gf.plans.map((p) => [p.id, p.n])).toEqual([
      ['pl1', 1],
      ['alacarte', 0],
      ['pl8', 1],
    ]);
  });
});

describe('filterProfiles', () => {
  it('shows everyone with no filter', () => {
    expect(filterProfiles(rows, NO_FILTER)).toHaveLength(residents.length);
    expect(isFiltered(NO_FILTER)).toBe(false);
  });

  it('matches anyone with any of the chosen tags', () => {
    expect(names(filterProfiles(rows, { ...NO_FILTER, tags: ['allergy|Shellfish', 'texture|Puree'] }))).toEqual(['Rose Delgado', 'Frank Dellacroce']);
    expect(filterProfiles(rows, { ...NO_FILTER, tags: [anyOf('allergy')] })).toHaveLength(5);
    expect(filterProfiles(rows, { ...NO_FILTER, tags: ['none'] })).toHaveLength(17);
  });

  it('combines care level, tags and plan', () => {
    const f = { ...NO_FILTER, level: 'AL', tags: ['allergy|Gluten'], plan: 'pl8' };
    expect(isFiltered(f)).toBe(true);
    expect(names(filterProfiles(rows, f))).toEqual(['Mildred Vanholder']);
    expect(filterProfiles(rows, { ...f, level: 'IL' })).toHaveLength(0);
  });

  it('finds à la carte residents, whether on the $0 plan or none', () => {
    expect(names(filterProfiles(rows, { ...NO_FILTER, plan: 'alacarte' }))).toEqual(['Walter Okonkwo', 'Harold Yeung']);
  });

  it('searches names and apartments first, then tags and the care assessment wording', () => {
    expect(names(filterProfiles(rows, { ...NO_FILTER, query: 'mussels' }))).toEqual(['Rose Delgado']);
    expect(names(filterProfiles(rows, { ...NO_FILTER, query: 'gluten-free' }))).toEqual(['Mildred Vanholder', 'Beatrice Sanderson']);
    expect(filterProfiles(rows, { ...NO_FILTER, query: 'dorothy' }).map((x) => x.r.name)).toEqual(['Dorothy Hale', 'Dorothy Kessler']);
    expect(filterProfiles(rows, { ...NO_FILTER, query: 'dorothy', level: 'AL' })).toHaveLength(0);
  });
});

describe('unlistedAllergens', () => {
  const joan = residents.find((r) => r.name === 'Joan Petrovic') as Resident;
  it('flags an allergen the kitchen notes mention but the lists leave out', () => {
    expect(unlistedAllergens(joan, 'NO peanut products — severe')).toEqual([]);
    expect(unlistedAllergens({ allergies: [], diet: [] }, 'NO peanut products — severe')).toEqual(['Peanuts']);
    expect(unlistedAllergens({ allergies: [] }, undefined)).toEqual([]);
  });
});
