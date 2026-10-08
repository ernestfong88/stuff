import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { getResident } from '../../data';
import { DiningProvider, useDining, type DiningApi } from '../../store/dining';
import { createDiningEngine } from '../../store/diningEngine';
import { T0, freezeClock } from './helpers';

beforeEach(() => freezeClock());
afterEach(() => vi.useRealTimers());

/** Render the provider once and hand back its API and engine. */
function mount() {
  const engine = createDiningEngine({ seed: () => ({ orders: [], history: [], assocOrders: [] }), channel: null, persistKey: null });
  let api: DiningApi | null = null;
  function Grab() {
    api = useDining();
    return null;
  }
  renderToString(
    <DiningProvider engine={engine}>
      <Grab />
    </DiningProvider>,
  );
  return { api: api!, engine };
}

describe('DiningProvider', () => {
  it('opens a check, seats, rings in and sends, writing the trail as it goes', () => {
    const { api, engine } = mount();
    const id = api.openOrder('t_sq3', 'sequoia', 'Dinner', 'AA');
    expect(api.openOrder('t_sq3', 'sequoia', 'Dinner', 'AA')).toBe(id);
    const seat = api.addDiner(id, 'resident', 'r1')!;
    api.addItem(id, seat, 'd_peach', {});
    api.addItem(id, seat, 'd_cbsoup', {});
    api.sendOrder(id);

    const o = engine.get().orders[0];
    const name = getResident('r1')!.name;
    expect(o.log!.map((e) => e.what)).toEqual([
      'Opened the check',
      'Seated ' + name,
      'Added Peach Chicken for ' + name,
      'Added Cheeseburger Soup for ' + name,
      'Sent 2 plates (C1, C2)',
    ]);
    expect(o.log!.every((e) => e.at === T0 && e.by === 'Adriana')).toBe(true);
    const states = Object.fromEntries(o.diners[0].items.map((i) => [i.itemId, i.kitchenState]));
    expect(states).toEqual({ d_peach: 'scheduled', d_mashed: 'scheduled', d_greenbeans: 'scheduled', d_cbsoup: 'ready' });
  });

  it('closes into history, reopens and clears the floor', () => {
    const { api, engine } = mount();
    const id = api.newCheck('t_sq3', 'sequoia');
    const seat = api.addDiner(id, 'resident', 'r1')!;
    api.addItem(id, seat, 'd_trifle', {});
    api.closeOrder(id, { [seat]: 'card' });
    expect(engine.get().history[0].log!.at(-1)!.what).toBe('Closed the check');
    api.reopenOrder(id);
    expect(engine.get().orders[0].id).toBe(id);
    api.clearAll();
    expect(engine.get().orders).toEqual([]);
  });
});
