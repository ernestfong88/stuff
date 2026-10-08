import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSharedStore } from '../sharedStore';
import { flushWrites, setWriteDelay, WRITE_DELAY_MS } from '../writeBehind';

/** A Map-backed localStorage on a stub window that counts writes. */
function stubStorage() {
  const data = new Map<string, string>();
  const writes: string[] = [];
  const localStorage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      writes.push(k);
      data.set(k, String(v));
    },
    removeItem: (k: string) => void data.delete(k),
  };
  vi.stubGlobal('window', { localStorage, location: { search: '' } });
  return { data, writes };
}

let n = 0;
const key = () => `kisco_test_${++n}`;

beforeEach(() => {
  vi.useFakeTimers();
  setWriteDelay(WRITE_DELAY_MS);
});
afterEach(() => {
  setWriteDelay(0);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('shared store persistence', () => {
  it('tells listeners at once and writes a run of changes once, a moment later', () => {
    const { data, writes } = stubStorage();
    const k = key();
    const store = createSharedStore(0, { persistKey: k });
    const heard = vi.fn();
    store.subscribe(heard);

    store.set(1);
    store.set(2);
    store.set((x) => x + 1);
    expect(store.get()).toBe(3);
    expect(heard).toHaveBeenCalledTimes(3);
    expect(writes).toEqual([]);

    vi.advanceTimersByTime(WRITE_DELAY_MS - 1);
    expect(writes).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(writes).toEqual([k]);
    expect(JSON.parse(data.get(k)!)).toBe(3);
  });

  it('flushes waiting writes on demand, for every store', () => {
    const { data, writes } = stubStorage();
    const [k1, k2] = [key(), key()];
    const a = createSharedStore<string[]>([], { persistKey: k1 });
    const b = createSharedStore({ on: false }, { persistKey: k2 });
    a.set(['x']);
    b.set({ on: true });
    expect(writes).toEqual([]);
    flushWrites();
    expect(writes.sort()).toEqual([k1, k2].sort());
    expect(JSON.parse(data.get(k1)!)).toEqual(['x']);
    expect(JSON.parse(data.get(k2)!)).toEqual({ on: true });
    // Nothing left to write when the timer comes round.
    vi.advanceTimersByTime(WRITE_DELAY_MS);
    expect(writes).toHaveLength(2);
  });

  it('a new store reads what the last one wrote, once flushed', () => {
    stubStorage();
    const k = key();
    createSharedStore('seed', { persistKey: k }).set('changed');
    expect(createSharedStore('seed', { persistKey: k }).get()).toBe('seed');
    flushWrites();
    expect(createSharedStore('seed', { persistKey: k }).get()).toBe('changed');
  });

  it('reset writes the initial value straight away', () => {
    const { data } = stubStorage();
    const k = key();
    const store = createSharedStore(5, { persistKey: k });
    store.set(9);
    store.reset();
    expect(store.get()).toBe(5);
    expect(JSON.parse(data.get(k)!)).toBe(5);
    vi.advanceTimersByTime(WRITE_DELAY_MS);
    expect(JSON.parse(data.get(k)!)).toBe(5);
  });

  it('writes at once with no delay (outside a browser)', () => {
    setWriteDelay(0);
    const { data } = stubStorage();
    const k = key();
    createSharedStore(0, { persistKey: k }).set(7);
    expect(JSON.parse(data.get(k)!)).toBe(7);
  });
});
