import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../../../domain/config';
import type { Order } from '../../../../domain/types';
import type { PlanItem } from '../../../../store/floorLayout';
import { routableItems, routingView } from '../../../kitchen/admin/routingList';
import { labelProblems } from '../../../manager/floor/planCheck';
import { ADP_ASSOCIATES } from '../../seed/associates';
import type { Charge } from '../../seed/billing';
import { filterAssociates } from '../access/pins';
import { chargeStep, itemLabel, sendToBilling } from '../chargeReview/charges';
import { buildRows, filterRows } from '../orders/orderRows';
import { insertTag, unknownTags } from '../textTags';

describe('text wording', () => {
  it('finds tags a text cannot fill in, each once', () => {
    expect(unknownTags('Hi {first}, apt {apt} {apt} {frist}', ['first', 'meal'])).toEqual(['apt', 'frist']);
    expect(unknownTags('Hi {first}', ['first'])).toEqual([]);
    expect(unknownTags('Hi {}', ['first'])).toEqual(['']);
  });
  it('adds a tag at the cursor with spaces where needed', () => {
    expect(insertTag('Hi there', 'first', 2)).toEqual({ body: 'Hi {first} there', cursor: 10 });
    expect(insertTag('Hi ', 'first')).toEqual({ body: 'Hi {first}', cursor: 10 });
    expect(insertTag('Ready.', 'first', 0)).toEqual({ body: '{first} Ready.', cursor: 8 });
    expect(insertTag('Hi Bob, ok', 'first', 3, 6).body).toBe('Hi {first}, ok');
  });
});

describe('charge steps', () => {
  const c: Charge = { id: 'a', residentId: 'r1', level: 'IL', date: 0, item: 'TRAY', desc: '', amount: 5, active: true, approvedAt: null, approvedBy: null, importedAt: null, source: 'delivery' };
  it('says where a charge is', () => {
    expect(chargeStep(c)).toBe('waiting');
    expect(chargeStep({ ...c, approvedAt: 1 })).toBe('approved');
    expect(chargeStep({ ...c, active: false })).toBe('voided');
    expect(chargeStep({ ...c, approvedAt: 1, importedAt: 2 })).toBe('sent');
  });
  it('sends only approved, live charges to billing', () => {
    const out = sendToBilling([c, { ...c, id: 'b', approvedAt: 1 }, { ...c, id: 'v', approvedAt: 1, active: false }], 9);
    expect(out.map((x) => x.importedAt)).toEqual([null, 9, null]);
  });
  it('names item codes in words', () => {
    expect(itemLabel('GMEAL')).toBe('Guest meal');
    expect(itemLabel('SPA')).toBe('SPA');
  });
});

describe('order history status', () => {
  const order = (id: string, patch: Partial<Order>): Order => ({
    id,
    room: 'sequoia',
    server: 'AA',
    meal: 'Dinner',
    openedAt: 1,
    diners: [{ id: id + 'd', kind: 'resident', refId: 'r1', isGuest: false, seat: 1, items: [] }],
    ...patch,
  });
  it('filters open and closed checks', () => {
    const rows = buildRows([order('open', { openedAt: 7 })], [order('done', { closedAt: 5 })], DEFAULT_CONFIG);
    const ids = (status: 'all' | 'open' | 'closed') => filterRows(rows, { query: '', server: 'All', charge: 'All', status }).map((r) => r.order.id);
    expect(ids('open')).toEqual(['open']);
    expect(ids('closed')).toEqual(['done']);
    expect(ids('all')).toEqual(['open', 'done']);
  });
});

describe('associates added lately', () => {
  it('shows only those added in the last 30 days', () => {
    const rows = filterAssociates(ADP_ASSOCIATES, { query: '', how: 'all', newOnly: true, sort: { key: 'name', dir: 1 } });
    expect(rows.length).toBe(ADP_ASSOCIATES.filter((a) => a.days <= 30).length);
    expect(rows.every((a) => a.days <= 30)).toBe(true);
  });
});

describe('kitchen routing, whole menu', () => {
  it('lists every recipe by menu group when asked, without a search', () => {
    const items = routableItems();
    const view = routingView(items, 'sequoia', DEFAULT_CONFIG, '', true);
    expect(view.reduce((n, g) => n + g.items.length, 0)).toBe(items.length);
    expect(view.map((g) => g.title)).not.toContain('Server makes it');
  });
});

describe('floor plan names', () => {
  const t = (id: string, label: string, type: PlanItem['type'] = 'seat'): PlanItem => ({ id, label, type, section: '', x: 0, y: 0, w: 10, h: 10 });
  it('flags blank and shared table names, never walls', () => {
    expect(labelProblems([t('a', 'SQ 1'), t('b', 'sq 1 '), t('c', ' '), t('d', 'SQ 2'), t('w', 'Wall', 'wall'), t('w2', 'Wall', 'wall')])).toEqual({
      a: 'duplicate',
      b: 'duplicate',
      c: 'blank',
    });
  });
});
