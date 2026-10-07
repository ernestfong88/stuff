import { describe, expect, it } from 'vitest';
import { printGroupOf, printJobs, printSummary, unprintedGroups, type RoutedPrinter } from '../printing';

const hot: RoutedPrinter = { id: 'p1', name: 'Hot Line', type: 'Kitchen', reachable: true, print: ['Entrées', 'Sides'] };
const cold: RoutedPrinter = { id: 'p2', name: 'Pantry', type: 'Kitchen', reachable: true, print: ['Starters', 'Desserts'] };
const pass: RoutedPrinter = { id: 'p3', name: 'Expo', type: 'Receipt', reachable: true };
const label: RoutedPrinter = { id: 'p4', name: 'Labels', type: 'Label', reachable: true };

const ticket = [
  { name: 'Soup', category: 'Starters' },
  { name: 'Salmon', category: 'Entrées' },
  { name: 'Rice', category: 'Sides' },
  { name: 'Pie', category: 'Desserts' },
];

describe('printer routing', () => {
  it('maps menu categories to print groups', () => {
    expect(printGroupOf('Specials')).toBe('Entrées');
    expect(printGroupOf('Add-Ons')).toBe('Sides');
    expect(printGroupOf('Cocktails')).toBe('Drinks');
  });

  it('splits a ticket by printer, and a whole-ticket printer gets everything', () => {
    const jobs = printJobs(ticket, [hot, cold, pass, label]);
    expect(jobs.map((j) => [j.printer.name, j.items])).toEqual([
      ['Hot Line', ['Salmon', 'Rice']],
      ['Pantry', ['Soup', 'Pie']],
      ['Expo', ['Soup', 'Salmon', 'Rice', 'Pie']],
    ]);
    expect(printSummary(jobs)).toBe('Printed at Hot Line (2 items) · Pantry (2 items) · Expo (whole ticket)');
  });

  it('skips a printer with nothing on this ticket', () => {
    expect(printJobs([{ name: 'Pie', category: 'Desserts' }], [hot, cold]).map((j) => j.printer.name)).toEqual(['Pantry']);
  });

  it('finds groups no printer prints', () => {
    expect(unprintedGroups([hot, cold])).toEqual(['Drinks']);
    expect(unprintedGroups([pass])).toEqual([]);
  });
});
