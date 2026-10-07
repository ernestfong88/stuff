import { describe, expect, it } from 'vitest';
import { diner, line, order } from '../../../domain/__tests__/helpers';
import { linesToRestore, snapshotLines } from '../lineSnapshot';

describe('bump undo snapshots', () => {
  const ready = line('d_peach', { sent: true, kitchenState: 'ready' });
  const cooking = line('d_shells', { sent: true, kitchenState: 'cooking' });
  const ran = line('d_cbsoup', { sent: true, kitchenState: 'cleared' });
  const before = order([diner([ready, cooking, ran])]);

  it('takes every plate not yet on the table, or just the ones asked for', () => {
    expect(snapshotLines(before).map((l) => l.id)).toEqual([ready.id, cooking.id]);
    expect(snapshotLines(before, [cooking.id, 'gone'])).toEqual([{ id: cooking.id, state: 'cooking' }]);
  });

  it('puts back only the plates that moved', () => {
    const snap = snapshotLines(before);
    const after = order([diner([{ ...ready, kitchenState: 'cleared' }, cooking, ran])]);
    expect(linesToRestore(snap, after)).toEqual([{ id: ready.id, state: 'ready' }]);
  });

  it('skips plates no longer on the check', () => {
    const snap = snapshotLines(before);
    expect(linesToRestore(snap, order([diner([cooking])]))).toEqual([]);
  });
});
