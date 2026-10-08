import { describe, expect, it } from 'vitest';
import { matchRecipes } from '../RecipeSearchBox';

const r = (id: string, name: string) => ({ id, name, cat: 'Entrees' });
const book = [r('a', 'Peach Glazed Chicken Breast'), r('b', 'Chicken Marsala'), r('c', 'BBQ Chicken Wings'), r('d', 'Salmon Burger')];

describe('matchRecipes', () => {
  it('matches every typed word at the start of a word, names starting with the text first', () => {
    expect(matchRecipes(book, 'chick').map((x) => x.id)).toEqual(['b', 'c', 'a']);
    expect(matchRecipes(book, 'peach chi').map((x) => x.id)).toEqual(['a']);
    expect(matchRecipes(book, 'arsala')).toEqual([]);
    expect(matchRecipes(book, '  ')).toEqual([]);
    expect(matchRecipes(book, 'c', 2)).toHaveLength(2);
  });
});
