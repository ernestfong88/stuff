import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DINING_STORAGE_KEY,
  LEADER_KEY,
  LEADER_LEASE_MS,
  claimPacingLeadership,
  createDiningEngine,
} from '../../store/diningEngine';
import { flushWrites, setWriteDelay } from '../../lib/writeBehind';
import type { DiningState } from '../diningState';
import { order } from './helpers';

/** A Map-backed localStorage on a stub window, as the browser would give. */
function stubStorage() {
  const data = new Map<string, string>();
  const localStorage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
  };
  vi.stubGlobal('window', { localStorage, location: { search: '' } });
  return data;
}

const seed = (): DiningState => ({ orders: [order([], { id: 'seed' })], history: [], assocOrders: [] });

beforeEach(() => {
  vi.unstubAllGlobals();
});
afterEach(() => vi.unstubAllGlobals());

describe('dining engine', () => {
  it('falls back to the seed when nothing (or something corrupt) is saved', () => {
    const data = stubStorage();
    expect(createDiningEngine({ seed, channel: null }).get().orders[0].id).toBe('seed');
    data.set(DINING_STORAGE_KEY, '{not json');
    expect(createDiningEngine({ seed, channel: null }).get().orders[0].id).toBe('seed');
    data.set(DINING_STORAGE_KEY, JSON.stringify({ v: 1, day: new Date().toDateString(), orders: 'x' }));
    expect(createDiningEngine({ seed, channel: null }).get().orders[0].id).toBe('seed');
  });

  it('persists local changes and restores them; reset brings the seed back', () => {
    stubStorage();
    const a = createDiningEngine({ seed, channel: null });
    a.update((s) => ({ ...s, orders: [...s.orders, order([], { id: 'new' })] }));
    const b = createDiningEngine({ seed, channel: null });
    expect(b.get().orders.map((o) => o.id)).toEqual(['seed', 'new']);
    b.reset();
    expect(createDiningEngine({ seed, channel: null }).get().orders.map((o) => o.id)).toEqual(['seed']);
  });

  it('saves a run of changes once, a moment later; reset saves at once', () => {
    vi.useFakeTimers();
    setWriteDelay(300);
    const data = stubStorage();
    const a = createDiningEngine({ seed, channel: null });
    a.update((s) => ({ ...s, orders: [...s.orders, order([], { id: 'one' })] }));
    a.update((s) => ({ ...s, orders: [...s.orders, order([], { id: 'two' })] }));
    expect(a.get().orders).toHaveLength(3);
    expect(data.has(DINING_STORAGE_KEY)).toBe(false);
    vi.advanceTimersByTime(300);
    expect(JSON.parse(data.get(DINING_STORAGE_KEY)!).orders.map((o: { id: string }) => o.id)).toEqual(['seed', 'one', 'two']);
    a.update((s) => ({ ...s, orders: [] }));
    flushWrites();
    expect(JSON.parse(data.get(DINING_STORAGE_KEY)!).orders).toEqual([]);
    a.reset();
    expect(JSON.parse(data.get(DINING_STORAGE_KEY)!).orders.map((o: { id: string }) => o.id)).toEqual(['seed']);
    setWriteDelay(0);
    vi.useRealTimers();
  });

  it('ignores another day’s saved state', () => {
    const data = stubStorage();
    data.set(
      DINING_STORAGE_KEY,
      JSON.stringify({ v: 1, day: 'Mon Jan 01 2001', orders: [order([], { id: 'old' })], history: [], assocOrders: [] }),
    );
    expect(createDiningEngine({ seed, channel: null }).get().orders[0].id).toBe('seed');
  });

  it('syncs changes to other tabs without echoing them back', async () => {
    const channel = 'test-dining-' + Math.random();
    const a = createDiningEngine({ seed, channel, persistKey: null });
    const b = createDiningEngine({ seed, channel, persistKey: null });
    const stopA = a.connect();
    const stopB = b.connect();
    const seenByA = vi.fn();
    a.subscribe(seenByA);

    a.update((s) => ({ ...s, orders: [order([], { id: 'from-a' })] }));
    await vi.waitFor(() => expect(b.get().orders.map((o) => o.id)).toEqual(['from-a']));
    // a notified once for its own change and never for an echo.
    await new Promise((r) => setTimeout(r, 20));
    expect(seenByA).toHaveBeenCalledTimes(1);

    b.update((s) => ({ ...s, history: [order([], { id: 'closed' })] }));
    await vi.waitFor(() => expect(a.get().history.map((o) => o.id)).toEqual(['closed']));
    stopA();
    stopB();
  });

  it('drops out-of-order messages from the same tab', async () => {
    const channel = 'test-dining-' + Math.random();
    const b = createDiningEngine({ seed, channel, persistKey: null });
    const stop = b.connect();
    const sender = new BroadcastChannel(channel);
    sender.postMessage({ from: 'x', seq: 2, orders: [order([], { id: 'two' })] });
    sender.postMessage({ from: 'x', seq: 1, orders: [order([], { id: 'one' })] });
    await new Promise((r) => setTimeout(r, 30));
    expect(b.get().orders.map((o) => o.id)).toEqual(['two']);
    sender.close();
    stop();
  });
});

describe('pacing leader election', () => {
  it('one tab holds the lease until it goes quiet', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    const data = stubStorage();
    expect(claimPacingLeadership('a')).toBe(true);
    expect(claimPacingLeadership('b')).toBe(false);
    vi.setSystemTime(1_000_000 + LEADER_LEASE_MS);
    expect(claimPacingLeadership('b')).toBe(false);
    vi.setSystemTime(1_000_000 + LEADER_LEASE_MS + 1);
    expect(claimPacingLeadership('b')).toBe(true);
    expect(JSON.parse(data.get(LEADER_KEY)!).id).toBe('b');
    vi.useRealTimers();
  });

  it('every tab paces when storage is unavailable', () => {
    expect(claimPacingLeadership('a')).toBe(true);
    expect(claimPacingLeadership('b')).toBe(true);
  });
});
