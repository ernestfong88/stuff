import { describe, expect, it } from 'vitest';
import { filterCommunityGroups } from '../../kit/community';
import { BO_ALIASES, BO_MORE_PAGES, BO_PAGES, findPage, navPageId } from '../../nav';
import { searchPages } from '../search';
import { isSearchShortcut, shortcutLabel } from '../shortcut';

const page = (id: string, label: string, blurb = '', keywords = '', section = 'S') => ({ id, label, blurb, keywords, section });

describe('page search', () => {
  const pages = [page('a', 'Pricing', 'Resident, guest and a la carte prices'), page('b', 'Alerts & Timing', 'When tables turn red', 'red late timer'), page('c', 'Recipe Book', 'Your recipes', 'price')];
  it('lists everything for an empty query', () => {
    expect(searchPages(pages, '  ')).toHaveLength(3);
  });
  it('needs every word somewhere and ranks label matches first', () => {
    expect(searchPages(pages, 'red tables').map((p) => p.id)).toEqual(['b']);
    expect(searchPages(pages, 'pric').map((p) => p.id)).toEqual(['a', 'c']);
  });
  it('finds a page by its section name', () => {
    expect(searchPages([page('x', 'Meal Plans', '', '', 'Billing')], 'billing')).toHaveLength(1);
  });
});

describe('shortcut', () => {
  it('names the key for the platform', () => {
    expect(shortcutLabel('MacIntel')).toBe('⌘ K');
    expect(shortcutLabel('Win32')).toBe('Ctrl K');
  });
  it('is Ctrl K or ⌘ K only', () => {
    const k = { key: 'k', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false };
    expect(isSearchShortcut(k)).toBe(true);
    expect(isSearchShortcut({ ...k, ctrlKey: false, metaKey: true, key: 'K' })).toBe(true);
    expect(isSearchShortcut({ ...k, shiftKey: true })).toBe(false);
    expect(isSearchShortcut({ ...k, ctrlKey: false })).toBe(false);
  });
});

describe('nav', () => {
  it('has unique page ids', () => {
    const ids = [...BO_PAGES, ...BO_MORE_PAGES].map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('files a page opened from another page under that page', () => {
    expect(findPage('residents')?.section.id).toBe('residents');
    expect(navPageId('residents')).toBe('resProfiles');
    expect(navPageId('fees')).toBe('fees');
    expect(findPage('nope')).toBeNull();
  });
});

describe('community search', () => {
  const cols: Array<Array<[string, string[]]>> = [[['Balfour', ['Balfour Littleton', 'Balfour Louisville']]], [['Lifestyle', ['Valencia Terrace', 'The Fountains']]]];
  it('keeps the grouping and drops empty groups', () => {
    expect(filterCommunityGroups(cols, 'valen')).toEqual([[['Lifestyle', ['Valencia Terrace']]]]);
  });
  it('matches a whole group by its name', () => {
    expect(filterCommunityGroups(cols, 'balfour')[0][0][1]).toHaveLength(2);
  });
});

describe('merged pages', () => {
  it('sends every old page address to a page that exists, and never to another old address', () => {
    for (const a of BO_ALIASES) {
      expect(findPage(a.to[0]), a.id).not.toBeNull();
      expect(BO_ALIASES.some((x) => x.id === a.to[0]), a.id).toBe(false);
      expect(BO_PAGES.some((p) => p.id === a.id), `${a.id} is both a page and an old address`).toBe(false);
    }
  });
});
