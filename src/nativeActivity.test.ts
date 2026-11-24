import { describe, expect, it } from 'vitest';
import { createNative, native, nextSet, type Bridge } from './native';

type Call = [string, string, unknown];

function fakeBridge(available?: (name: string) => boolean, fail?: (method: string) => boolean): Bridge & { calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    nativePromise(plugin, method, options) {
      calls.push([plugin, method, options]);
      return fail?.(method) ? Promise.reject(new Error('nope')) : Promise.resolve({});
    },
    ...(available ? { isPluginAvailable: available } : {}),
  };
}

const withPlugin = (fail?: (method: string) => boolean) => fakeBridge((name) => name === 'RestActivity', fail);

describe('rest activity without the plugin', () => {
  it('is a no-op without a bridge', async () => {
    const n = createNative(null);
    await expect(n.startRest(10_000, 'Dips', 'Satz 2/4', 1000)).resolves.toBeUndefined();
    await expect(n.updateRest(10_000, 1000)).resolves.toBeUndefined();
    await expect(n.endRest()).resolves.toBeUndefined();
    await expect(native.endRest()).resolves.toBeUndefined();
  });

  it('is a no-op when the bridge has no isPluginAvailable', async () => {
    const b = fakeBridge();
    const n = createNative(b);
    await expect(n.startRest(10_000, 'Dips', 'Satz 2/4', 1000)).resolves.toBeUndefined();
    await expect(n.updateRest(10_000, 1000)).resolves.toBeUndefined();
    await expect(n.endRest()).resolves.toBeUndefined();
    expect(b.calls).toEqual([]);
  });

  it('is a no-op when the plugin is not available', async () => {
    const asked: string[] = [];
    const b = fakeBridge((name) => { asked.push(name); return false; });
    const n = createNative(b);
    await expect(n.startRest(10_000, 'Dips', 'Satz 2/4', 1000)).resolves.toBeUndefined();
    await expect(n.updateRest(10_000, 1000)).resolves.toBeUndefined();
    await expect(n.endRest()).resolves.toBeUndefined();
    expect(b.calls).toEqual([]);
    expect(new Set(asked)).toEqual(new Set(['RestActivity']));
  });

  it('keeps notification and haptics working without the plugin', async () => {
    const b = fakeBridge(() => false);
    const n = createNative(b);
    await n.tap();
    await n.startRest(10_000, 'Dips', 'Satz 2/4', 1000);
    await n.cancelRest();
    expect(b.calls.map((c) => c.slice(0, 2))).toEqual([['Haptics', 'impact'], ['LocalNotifications', 'cancel']]);
  });
});

describe('rest activity with the plugin', () => {
  it('starts with end time, exercise and set', async () => {
    const b = withPlugin();
    await createNative(b).startRest(10_000, 'Dips', 'Satz 2/4', 1000);
    expect(b.calls).toEqual([['RestActivity', 'startRest', { endsAt: 10_000, exercise: 'Dips', set: 'Satz 2/4' }]]);
  });

  it('updates with the new end time only', async () => {
    const b = withPlugin();
    await createNative(b).updateRest(25_000, 1000);
    expect(b.calls).toEqual([['RestActivity', 'updateRest', { endsAt: 25_000 }]]);
  });

  it('ends without options', async () => {
    const b = withPlugin();
    await createNative(b).endRest();
    expect(b.calls).toEqual([['RestActivity', 'endRest', undefined]]);
  });

  it('ends instead of starting when endAt is not in the future', async () => {
    const b = withPlugin();
    const n = createNative(b);
    await n.startRest(1000, 'Dips', 'Satz 2/4', 1000);
    await n.startRest(500, 'Dips', 'Satz 2/4', 1000);
    expect(b.calls).toEqual([['RestActivity', 'endRest', undefined], ['RestActivity', 'endRest', undefined]]);
  });

  it('ends instead of updating when endAt is not in the future', async () => {
    const b = withPlugin();
    const n = createNative(b);
    await n.updateRest(1000, 1000);
    await n.updateRest(500, 1000);
    expect(b.calls).toEqual([['RestActivity', 'endRest', undefined], ['RestActivity', 'endRest', undefined]]);
  });

  it('uses the current time by default', async () => {
    const b = withPlugin();
    const n = createNative(b);
    await n.startRest(Date.now() + 60_000, 'Dips', '');
    await n.updateRest(Date.now() - 1);
    expect(b.calls.map((c) => c[1])).toEqual(['startRest', 'endRest']);
  });

  it('keeps the order start, update, end while calls are pending', async () => {
    const order: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const b: Bridge = {
      isPluginAvailable: () => true,
      nativePromise(_plugin, method) {
        order.push(`${method}:start`);
        const done = () => { order.push(`${method}:end`); };
        return method === 'startRest' ? gate.then(done) : Promise.resolve().then(done);
      },
    };
    const n = createNative(b);
    const all = [n.startRest(10_000, 'Dips', 'Satz 2/4', 1000), n.updateRest(25_000, 1000), n.endRest()];
    await Promise.resolve();
    expect(order).toEqual(['startRest:start']);
    release();
    await Promise.all(all);
    expect(order).toEqual(['startRest:start', 'startRest:end', 'updateRest:start', 'updateRest:end', 'endRest:start', 'endRest:end']);
  });

  it('keeps the order and resolves when a call rejects', async () => {
    const b = withPlugin((method) => method === 'startRest' || method === 'updateRest');
    const n = createNative(b);
    const start = n.startRest(10_000, 'Dips', 'Satz 2/4', 1000);
    const update = n.updateRest(25_000, 1000);
    const end = n.endRest();
    await expect(start).resolves.toBeUndefined();
    await expect(update).resolves.toBeUndefined();
    await expect(end).resolves.toBeUndefined();
    expect(b.calls.map((c) => c[1])).toEqual(['startRest', 'updateRest', 'endRest']);
  });

  it('shares one queue with the notification calls', async () => {
    const b = withPlugin((method) => method === 'schedule');
    const n = createNative(b);
    void n.scheduleRest(10_000, 'Dips', true, 1000);
    void n.startRest(10_000, 'Dips', 'Satz 2/4', 1000);
    void n.cancelRest();
    await n.endRest();
    expect(b.calls.map((c) => c[1])).toEqual(['schedule', 'startRest', 'cancel', 'endRest']);
  });
});

describe('nextSet', () => {
  const e = (name: string | undefined, ...done: boolean[]) => ({ name, sets: done.map((d) => ({ done: d })) });

  it('stays on the same exercise and names its first open set', () => {
    expect(nextSet([e('Klimmzug', true, false), e('Dips', true, false, false, false)], 1)).toEqual({ exercise: 'Dips', set: 'Satz 2/4' });
  });

  it('takes the first open set, not the one after the checked one', () => {
    expect(nextSet([e('Dips', false, true, true, false)], 0)).toEqual({ exercise: 'Dips', set: 'Satz 1/4' });
  });

  it('jumps to the first open later exercise', () => {
    expect(nextSet([e('Klimmzug', true, true), e('Dips', false, false, false)], 0)).toEqual({ exercise: 'Dips', set: 'Satz 1/3' });
  });

  it('jumps to an earlier unfinished exercise', () => {
    expect(nextSet([e('Klimmzug', true, true, false), e('Dips', true), e('Rudern', true)], 1)).toEqual({ exercise: 'Klimmzug', set: 'Satz 3/3' });
  });

  it('skips entries without a name', () => {
    expect(nextSet([e(undefined, false), e('Dips', true), e('Rudern', false, false)], 0)).toEqual({ exercise: 'Rudern', set: 'Satz 1/2' });
  });

  it('gives null when everything is done', () => {
    expect(nextSet([e('Klimmzug', true), e('Dips', true)], 1)).toBeNull();
    expect(nextSet([], 0)).toBeNull();
  });
});
