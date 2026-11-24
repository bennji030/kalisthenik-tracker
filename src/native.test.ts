import { describe, expect, it } from 'vitest';
import { REST_NOTICE_ID, bridgeOf, createNative, native, nextExercise, restNotice, type Bridge } from './native';

type Call = [string, string, unknown];

function fakeBridge(fail?: (method: string) => boolean): Bridge & { calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    nativePromise(plugin, method, options) {
      calls.push([plugin, method, options]);
      return fail?.(method) ? Promise.reject(new Error('nope')) : Promise.resolve({});
    },
  };
}

const notif = (call: Call) => (call[2] as { notifications: Record<string, unknown>[] }).notifications;

describe('bridgeOf', () => {
  it('gives null outside the native shell', () => {
    expect(bridgeOf(undefined)).toBeNull();
    expect(bridgeOf({})).toBeNull();
    expect(bridgeOf({ Capacitor: { isNativePlatform: () => true } })).toBeNull();
    expect(bridgeOf({ Capacitor: { nativePromise: () => Promise.resolve(), isNativePlatform: () => false } })).toBeNull();
  });

  it('gives the bridge in the native shell', () => {
    const cap = { nativePromise: () => Promise.resolve(), isNativePlatform: () => true };
    expect(bridgeOf({ Capacitor: cap })).toBe(cap);
  });

  it('is a no-op in node', async () => {
    await expect(native.tap()).resolves.toBeUndefined();
  });
});

describe('nextExercise', () => {
  const e = (name: string | undefined, ...done: boolean[]) => ({ name, sets: done.map((d) => ({ done: d })) });

  it('stays on the same exercise while it has open sets', () => {
    expect(nextExercise([e('Klimmzug', true, false), e('Dips', false)], 0)).toBe('Klimmzug');
  });

  it('jumps to the first open later exercise', () => {
    expect(nextExercise([e('Klimmzug', true, true), e('Dips', false)], 0)).toBe('Dips');
  });

  it('jumps to the first open earlier exercise', () => {
    expect(nextExercise([e('Klimmzug', true, false), e('Dips', true), e('Rudern', true)], 1)).toBe('Klimmzug');
  });

  it('skips entries without a name', () => {
    expect(nextExercise([e(undefined, false), e('Dips', true), e('Rudern', false)], 1)).toBe('Rudern');
  });

  it('gives null when everything is done', () => {
    expect(nextExercise([e('Klimmzug', true), e('Dips', true)], 1)).toBeNull();
  });
});

describe('restNotice', () => {
  it('names the exercise', () => {
    expect(restNotice('Dips')).toEqual({ title: 'Pause vorbei', body: 'Weiter mit Dips' });
  });

  it('has a fallback body', () => {
    expect(restNotice(null)).toEqual({ title: 'Pause vorbei', body: 'Weiter geht’s' });
  });
});

describe('scheduleRest', () => {
  it('schedules one silent notification at endAt', async () => {
    const b = fakeBridge();
    const n = createNative(b);
    await n.scheduleRest(10_000, 'Dips', true, 1000);
    expect(b.calls.length).toBe(1);
    expect(b.calls[0].slice(0, 2)).toEqual(['LocalNotifications', 'schedule']);
    const list = notif(b.calls[0]);
    expect(list.length).toBe(1);
    const at = (list[0].schedule as { at: unknown }).at;
    expect(at).toBeInstanceOf(Date);
    expect((at as Date).getTime()).toBe(10_000);
    expect(list[0]).toEqual({
      id: REST_NOTICE_ID, title: 'Pause vorbei', body: 'Weiter mit Dips', schedule: { at }, silent: true, sound: 'rest.wav',
    });
    expect(Number.isInteger(REST_NOTICE_ID)).toBe(true);
  });

  it('leaves out the sound when not wanted', async () => {
    const b = fakeBridge();
    await createNative(b).scheduleRest(10_000, null, false, 1000);
    const n = notif(b.calls[0])[0];
    expect('sound' in n).toBe(false);
    expect(n.body).toBe('Weiter geht’s');
  });

  it('reuses the id on reschedule', async () => {
    const b = fakeBridge();
    const n = createNative(b);
    await n.scheduleRest(10_000, 'Dips', true, 1000);
    await n.scheduleRest(25_000, 'Dips', true, 1000);
    expect(notif(b.calls[1])[0].id).toBe(REST_NOTICE_ID);
    expect((notif(b.calls[1])[0].schedule as { at: Date }).at.getTime()).toBe(25_000);
  });

  it('only cancels when endAt is not in the future', async () => {
    const b = fakeBridge();
    await createNative(b).scheduleRest(1000, 'Dips', true, 1000);
    expect(b.calls).toEqual([['LocalNotifications', 'cancel', { notifications: [{ id: REST_NOTICE_ID }] }]]);
  });
});

describe('createNative', () => {
  it('sends cancel, tap and success payloads', async () => {
    const b = fakeBridge();
    const n = createNative(b);
    await n.cancelRest();
    await n.tap();
    await n.success();
    expect(b.calls).toEqual([
      ['LocalNotifications', 'cancel', { notifications: [{ id: REST_NOTICE_ID }] }],
      ['Haptics', 'impact', { style: 'LIGHT' }],
      ['Haptics', 'notification', { type: 'SUCCESS' }],
    ]);
  });

  it('asks for permission only once', async () => {
    const b = fakeBridge();
    const n = createNative(b);
    await n.requestPermission();
    await n.requestPermission();
    expect(b.calls).toEqual([['LocalNotifications', 'requestPermissions', undefined]]);
  });

  it('keeps call order and survives rejections', async () => {
    const order: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const b: Bridge = {
      nativePromise(_plugin, method) {
        order.push(`start ${method}`);
        if (method === 'schedule') return gate.then(() => { order.push('end schedule'); throw new Error('nope'); });
        return Promise.resolve();
      },
    };
    const n = createNative(b);
    const a = n.scheduleRest(10_000, 'Dips', true, 1000);
    const c = n.cancelRest();
    await Promise.resolve();
    expect(order).toEqual(['start schedule']);
    release();
    await expect(a).resolves.toBeUndefined();
    await expect(c).resolves.toBeUndefined();
    expect(order).toEqual(['start schedule', 'end schedule', 'start cancel']);
  });

  it('continues after a rejecting call', async () => {
    const b = fakeBridge((m) => m === 'impact');
    const n = createNative(b);
    await expect(n.tap()).resolves.toBeUndefined();
    await n.success();
    expect(b.calls.map((c) => c[1])).toEqual(['impact', 'notification']);
  });

  it('does nothing without a bridge', async () => {
    const n = createNative(null);
    await expect(n.requestPermission()).resolves.toBeUndefined();
    await expect(n.scheduleRest(10_000, 'Dips', true, 1000)).resolves.toBeUndefined();
    await expect(n.scheduleRest(0, null, false)).resolves.toBeUndefined();
    await expect(n.cancelRest()).resolves.toBeUndefined();
    await expect(n.tap()).resolves.toBeUndefined();
    await expect(n.success()).resolves.toBeUndefined();
  });
});
