import { describe, expect, it } from 'vitest';
import { orderFormReady, orderFormTodo, type OrderFormState } from '../associates/assocProgram';

const base: OrderFormState = { editing: false, name: 'maria lopez', item: 'Turkey Club', taken: false, missingGroup: null, overCutoff: false, reason: '' };

describe('associate order form', () => {
  it('is ready when everything is filled in', () => {
    expect(orderFormTodo(base)).toBeNull();
    expect(orderFormReady(base)).toBe(true);
  });

  it('asks for what is missing, in the order the form is filled in', () => {
    expect(orderFormTodo({ ...base, name: ' ', item: '' })).toBe('Type the associate’s name.');
    expect(orderFormTodo({ ...base, item: '' })).toBe('Pick a meal.');
    expect(orderFormTodo({ ...base, missingGroup: 'Side', overCutoff: true })).toBe('Pick a side.');
    expect(orderFormTodo({ ...base, overCutoff: true })).toBe('Add a reason for the override.');
    expect(orderFormReady({ ...base, overCutoff: true, reason: 'Covering a shift' })).toBe(true);
  });

  it('blocks a second meal for the same associate without repeating the warning', () => {
    const taken = { ...base, taken: true };
    expect(orderFormTodo(taken)).toBeNull();
    expect(orderFormReady(taken)).toBe(false);
  });

  it('needs a meal on a change too, since moving lunch to dinner clears it', () => {
    const edit = { ...base, editing: true, name: '', taken: true };
    expect(orderFormReady(edit)).toBe(true);
    expect(orderFormTodo({ ...edit, item: '' })).toBe('Pick a meal.');
    expect(orderFormReady({ ...edit, item: '' })).toBe(false);
  });
});
