import { describe, expect, it } from 'vitest';
import { getTable } from '../../../../data';
import { diner, order } from '../../../../domain/__tests__/helpers';
import { myChecksAt, pickerTable, seatCount } from '../floorTables';

describe('new check floor plan', () => {
  const sq3 = getTable('t_sq3')!;

  it('seats six at a round table and four elsewhere', () => {
    expect(seatCount({ ...sq3, shape: 'round' })).toBe(6);
    expect(seatCount({ ...sq3, shape: undefined })).toBe(4);
  });

  it('shows my check, other servers by first name, and when the table is full', () => {
    const mine = order([diner([]), diner([])], { tableId: 't_sq3', server: 'AA' });
    const theirs = order([diner([]), diner([]), diner([]), diner([])], { tableId: 't_sq3', server: 'RJ' });
    const p = pickerTable({ ...sq3, shape: 'round' }, [mine, theirs], 'AA');
    expect(p).toMatchObject({ mine: true, others: ['Ricardo'], covers: 6, seats: 6, full: true });
    expect(myChecksAt([mine, theirs], 't_sq3', 'AA')).toEqual([mine]);
  });
});
