import { describe, expect, it } from 'vitest';
import type { Session, Template } from './db';
import { isBackup } from './backupFormat';
import { dayStatus, plannedWeekdays } from './calendar';
import {
  cardioOnly, cardioSession, cardioSummary, ensureCardioDay, isCardio, isCardioSession, strengthOnly, type CardioDayStore,
} from './cardio';
import { entryNoon } from './entryDay';
import { sessionDayKeys, weekSessionCount } from './habits';
import { sessionMonthCount } from './monthTiles';
import { streak } from './streak';

const day = (y: number, m: number, d: number, h = 12) => new Date(y, m, d, h).getTime();
const strengthAt = (t: number): Session =>
  ({ id: `s${t}`, templateId: 'a', templateName: 'Pull A', startedAt: t, finishedAt: t + 3600e3, entries: [] });
const cardioAt = (t: number): Session =>
  ({ id: `c${t}`, templateId: 'c', templateName: 'Cardio', startedAt: t, finishedAt: t, entries: [], kind: 'cardio' });
const tpl = (id: string, weekdays: number[], order: number, kind?: 'cardio'): Template =>
  ({ id, name: id, weekdays, order, slots: [], ...(kind ? { kind } : {}) });

const plan = [tpl('Pull A', [1], 0), tpl('Push A', [2], 1), tpl('Pull B', [4], 2), tpl('Push B', [5], 3)];

describe('counting without cardio', () => {
  // Mittwoch 25.11.2026; Woche ab Mo 23.11., Vorwoche ab Mo 16.11.
  const now = day(2026, 10, 25, 18);
  const lastWeek = [16, 17, 19, 20].map((d) => strengthAt(day(2026, 10, d)));
  const thisWeek = [strengthAt(day(2026, 10, 23)), strengthAt(day(2026, 10, 24))];
  const cardio = [cardioAt(day(2026, 10, 18)), cardioAt(day(2026, 10, 25)), cardioAt(day(2026, 10, 4))];
  const all = [...lastWeek, ...cardio, ...thisWeek];
  const templates = [...plan, tpl('Cardio', [3], 4, 'cardio')];

  it('strength template count ignores the cardio day', () => {
    expect(strengthOnly(templates)).toHaveLength(4);
    expect(cardioOnly(templates).map((t) => t.name)).toEqual(['Cardio']);
  });
  it('streak', () => {
    expect(streak(strengthOnly(all), strengthOnly(templates).length, now)).toBe(6);
    // 3 Kraft + 1 Cardio in der Vorwoche reicht nicht fürs Ziel 4.
    const short = [...lastWeek.slice(0, 3), ...cardio, ...thisWeek];
    expect(streak(strengthOnly(short), 4, now)).toBe(2);
  });
  it('weekSessionCount', () => {
    expect(weekSessionCount(strengthOnly(all), now)).toBe(2);
    expect(weekSessionCount(all, now)).toBe(3);
  });
  it('sessionMonthCount', () => {
    expect(sessionMonthCount(strengthOnly(all), 2026, 10)).toBe(6);
    expect(sessionMonthCount(cardioOnly(all), 2026, 10)).toBe(3);
  });
  it('isCardio / isCardioSession', () => {
    expect(isCardio(templates[4])).toBe(true);
    expect(isCardio(templates[0])).toBe(false);
    expect(isCardioSession(cardio[0])).toBe(true);
    expect(isCardioSession(thisWeek[0])).toBe(false);
  });
});

describe('dayStatus with cardio', () => {
  const today = '2026-11-25'; // Mittwoch
  const strengthPlan = plannedWeekdays(strengthOnly([...plan, tpl('Cardio', [3, 1], 4, 'cardio')]));
  const cardioPlan = plannedWeekdays(cardioOnly([...plan, tpl('Cardio', [3, 1], 4, 'cardio')]));
  const strengthDone = sessionDayKeys([strengthAt(day(2026, 10, 23)), strengthAt(day(2026, 10, 24))]);
  const cardioDone = sessionDayKeys([cardioAt(day(2026, 10, 24)), cardioAt(day(2026, 10, 22)), cardioAt(day(2026, 10, 25))]);
  const status = (k: string) => dayStatus(k, today, strengthDone, strengthPlan, cardioDone, cardioPlan);

  it('strength done wins over cardio done', () => expect(status('2026-11-24')).toBe('done'));
  it('cardio done (also on an unplanned day)', () => {
    expect(status('2026-11-25')).toBe('cardio');
    expect(status('2026-11-22')).toBe('cardio');
  });
  it('cardio planned today or later → cardio-open', () => {
    expect(dayStatus('2026-11-25', today, new Set(), strengthPlan, new Set(), cardioPlan)).toBe('cardio-open');
    expect(status('2026-12-02')).toBe('cardio-open');
  });
  it('cardio planned in the past, nothing done → missed', () => expect(status('2026-11-18')).toBe('missed'));
  it('strength planned beats cardio planned on the same weekday', () => {
    expect(status('2026-11-30')).toBe('open'); // Montag: Pull A und Cardio
    expect(status('2026-11-16')).toBe('missed');
  });
  it('cardio done beats strength planned', () => {
    const done = sessionDayKeys([cardioAt(day(2026, 10, 26))]);
    expect(dayStatus('2026-11-26', today, new Set(), strengthPlan, done, cardioPlan)).toBe('cardio');
  });
  it('none without any plan', () => expect(status('2026-11-28')).toBe('none'));
  it('without the cardio arguments nothing changes', () => {
    expect(dayStatus('2026-11-25', today, strengthDone, strengthPlan)).toBe('none');
    expect(dayStatus('2026-11-26', today, strengthDone, strengthPlan)).toBe('open');
  });
});

// In-memory store; transaction() runs callbacks one at a time like IndexedDB rw transactions.
function memStore(init: { done?: boolean; templates?: Template[] } = {}) {
  const data = { done: init.done ?? false, templates: [...(init.templates ?? [])] };
  let lock = Promise.resolve();
  const store: CardioDayStore = {
    transaction: (fn) => {
      const run = lock.then(fn);
      lock = run.catch(() => {});
      return run;
    },
    isDone: async () => data.done,
    templates: async () => data.templates.map((t) => structuredClone(t)),
    add: async (t) => { await Promise.resolve(); data.templates.push(t); },
    markDone: async () => { data.done = true; },
  };
  return { store, data };
}

describe('ensureCardioDay', () => {
  it('adds one Cardio day on Wednesday after 4 strength days and leaves them unchanged', async () => {
    const before = structuredClone(plan);
    const { store, data } = memStore({ templates: plan });
    await ensureCardioDay(store);
    expect(data.templates).toHaveLength(5);
    expect(data.templates.slice(0, 4)).toEqual(before);
    expect(data.templates[4]).toMatchObject({ name: 'Cardio', weekdays: [3], kind: 'cardio', order: 4, slots: [] });
    expect(data.done).toBe(true);
  });
  it('next order follows the highest order, not the count', async () => {
    const { store, data } = memStore({ templates: [tpl('a', [1], 7), tpl('b', [2], 2)] });
    await ensureCardioDay(store);
    expect(data.templates[2].order).toBe(8);
  });
  it('empty store → order 0', async () => {
    const { store, data } = memStore();
    await ensureCardioDay(store);
    expect(data.templates).toHaveLength(1);
    expect(data.templates[0].order).toBe(0);
  });
  it('second call (also in parallel) adds nothing', async () => {
    const { store, data } = memStore({ templates: plan });
    await Promise.all([ensureCardioDay(store), ensureCardioDay(store)]);
    await ensureCardioDay(store);
    expect(cardioOnly(data.templates)).toHaveLength(1);
    expect(data.templates).toHaveLength(5);
  });
  it('flag already set → nothing, even without a cardio day', async () => {
    const { store, data } = memStore({ done: true, templates: plan });
    await ensureCardioDay(store);
    expect(data.templates).toHaveLength(4);
  });
  it('existing cardio template → nothing added, flag set', async () => {
    const { store, data } = memStore({ templates: [...plan, tpl('Laufen', [6], 4, 'cardio')] });
    await ensureCardioDay(store);
    expect(data.templates).toHaveLength(5);
    expect(data.done).toBe(true);
  });
});

describe('old backup data', () => {
  const old = {
    app: 'kalisthenik-tracker', version: 1, exercises: [], meta: [],
    templates: plan.map(({ id, name, weekdays, order, slots }): Template => ({ id, name, weekdays, order, slots })),
    sessions: [{ id: 'x', templateId: 'Pull A', templateName: 'Pull A', startedAt: 1, finishedAt: 2, entries: [] }] as Session[],
  };
  it('isBackup still accepts it', () => expect(isBackup(old)).toBe(true));
  it('everything without kind counts as strength', () => {
    expect(strengthOnly(old.templates)).toHaveLength(4);
    expect(cardioOnly(old.templates)).toHaveLength(0);
    expect(strengthOnly(old.sessions)).toHaveLength(1);
    expect(old.sessions.some(isCardioSession)).toBe(false);
  });
});

describe('cardioSummary', () => {
  it('four cases', () => {
    expect(cardioSummary({ minutes: 30, note: 'Laufen' })).toBe('30 min · Laufen');
    expect(cardioSummary({ minutes: 30 })).toBe('30 min');
    expect(cardioSummary({ note: 'Laufen' })).toBe('Laufen');
    expect(cardioSummary({})).toBe('Erledigt');
  });
  it('ignores invalid values', () => {
    expect(cardioSummary({ minutes: 0, note: '' })).toBe('Erledigt');
    expect(cardioSummary({ minutes: -5, note: '   ' })).toBe('Erledigt');
    expect(cardioSummary({ minutes: Number.NaN, note: 42 })).toBe('Erledigt');
    expect(cardioSummary({ minutes: Infinity, note: null })).toBe('Erledigt');
    expect(cardioSummary({ minutes: '30', note: ['Laufen'] })).toBe('Erledigt');
  });
});

describe('cardioSession', () => {
  const t = { id: 'c', name: 'Cardio' };
  const now = day(2026, 10, 25, 18);
  it('today: started = finished = now, empty fields not stored', () => {
    const s = cardioSession(t, undefined, null, '  ', now);
    expect(s).toMatchObject({ templateId: 'c', templateName: 'Cardio', startedAt: now, finishedAt: now, entries: [], kind: 'cardio' });
    expect('minutes' in s).toBe(false);
    expect('note' in s).toBe(false);
    expect(cardioSession(t, '2026-11-25', null, '', now).startedAt).toBe(now);
  });
  it('another day: noon of that day, rounded minutes, trimmed note', () => {
    const s = cardioSession(t, '2026-11-20', 29.6, ' Laufen ', now);
    expect(s.startedAt).toBe(entryNoon('2026-11-20'));
    expect(s.finishedAt).toBe(s.startedAt);
    expect(s.minutes).toBe(30);
    expect(s.note).toBe('Laufen');
  });
  it('minutes <= 0 are not stored', () => {
    expect('minutes' in cardioSession(t, undefined, 0, '', now)).toBe(false);
    expect('minutes' in cardioSession(t, undefined, -3, '', now)).toBe(false);
  });
});
