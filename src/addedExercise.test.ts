import { describe, expect, it } from 'vitest';
import type { EntryLog, Exercise, Session, SetLog, Slot, Template } from './db';
import { addedEntry, appendSlot, DEFAULT_SLOT, isAdded, planQuestions, slotFromEntry } from './addedExercise';
import { suggest } from './progression';

const dips: Exercise = { id: 'dips', name: 'Dips', type: 'weighted' };
const t2b: Exercise = { id: 't2b', name: 'Toes to Bar', type: 'reps' };

const slot = (id: string, exerciseId: string): Slot => ({ id, exerciseId, ...DEFAULT_SLOT });
const template: Template = { id: 't', name: 'Push A · schwer', weekdays: [2], order: 1, slots: [slot('s1', 'dips')] };

function set(done: boolean, weight: number | null = null, reps: number | null = 8): SetLog {
  return { targetReps: null, targetWeight: null, targetSec: null, reps, weight, sec: null, done };
}
function entry(slotId: string, exerciseId: string, sets: SetLog[]): EntryLog {
  return { slotId, exerciseId, restSec: 120, sets, kind: 'free', label: '', lastSummary: null };
}
function session(entries: EntryLog[]): Session {
  return { id: 'x', templateId: 't', templateName: 'Push A · schwer', startedAt: 0, finishedAt: 1, entries };
}

describe('addedEntry', () => {
  it('frei, 3 leere Sätze, 120 s Pause', () => {
    const e = addedEntry(t2b, 'new');
    expect(e.slotId).toBe('new');
    expect(e.exerciseId).toBe('t2b');
    expect(e.kind).toBe('free');
    expect(e.restSec).toBe(120);
    expect(e.label).toBe('Hinzugefügt – trag ein, was du machst');
    expect(e.lastSummary).toBeNull();
    expect(e.sets).toHaveLength(3);
    for (const s of e.sets) {
      expect(s).toEqual({ targetReps: null, targetWeight: null, targetSec: null, reps: null, weight: null, sec: null, done: false });
    }
    expect(e.sets[0]).not.toBe(e.sets[1]);
  });
});

describe('isAdded', () => {
  it('Slot des Tags → nicht hinzugefügt', () => {
    expect(isAdded(entry('s1', 'dips', []), template)).toBe(false);
  });
  it('unbekannter Slot → hinzugefügt', () => {
    expect(isAdded(entry('n1', 'dips', []), template)).toBe(true);
  });
  it('ohne Trainingstag ist alles hinzugefügt', () => {
    expect(isAdded(entry('s1', 'dips', []), undefined)).toBe(true);
  });
});

describe('planQuestions', () => {
  it('fragt nur hinzugefügte Übungen mit erledigtem Satz, in Reihenfolge', () => {
    const a = entry('n1', 't2b', [set(true), set(false)]);
    const b = entry('n2', 'pullups', [set(false)]);
    const c = entry('n3', 'lsit', [set(true)]);
    const planned = entry('s1', 'dips', [set(true)]);
    expect(planQuestions(session([planned, a, b, c]), template)).toEqual([a, c]);
  });
  it('keine Frage für Übungen, die schon im Tag sind', () => {
    expect(planQuestions(session([entry('n1', 'dips', [set(true)])]), template)).toEqual([]);
  });
  it('höchstens eine Frage pro Übung (erstes Vorkommen)', () => {
    const a = entry('n1', 't2b', [set(false)]);
    const b = entry('n2', 't2b', [set(true)]);
    const c = entry('n3', 't2b', [set(true)]);
    expect(planQuestions(session([a, b, c]), template)).toEqual([b]);
  });
  it('leer ohne Trainingstag oder bei Cardio', () => {
    const s = session([entry('n1', 't2b', [set(true)])]);
    expect(planQuestions(s, undefined)).toEqual([]);
    expect(planQuestions(s, { ...template, slots: [], kind: 'cardio' })).toEqual([]);
  });
});

describe('slotFromEntry', () => {
  it('Standardwerte und gleiche Slot-id', () => {
    expect(slotFromEntry(entry('n1', 't2b', [set(true)]), 'reps')).toEqual({
      id: 'n1', exerciseId: 't2b', sets: 3, repMin: 6, repMax: 10, increment: 2.5, startWeight: 0, restSec: 120, progression: true,
    });
  });
  it('mit Zusatzgewicht: Startgewicht vom ersten erledigten Satz', () => {
    const e = entry('n1', 'dips', [set(false, 5), set(true, 10), set(true, 12.5)]);
    expect(slotFromEntry(e, 'weighted').startWeight).toBe(10);
  });
  it('ohne Gewicht → 0', () => {
    expect(slotFromEntry(entry('n1', 'dips', [set(true, null)]), 'weighted').startWeight).toBe(0);
    expect(slotFromEntry(entry('n1', 'dips', [set(false, 10)]), 'weighted').startWeight).toBe(0);
  });
  it('ohne Zusatzgewicht bleibt das Startgewicht 0', () => {
    expect(slotFromEntry(entry('n1', 't2b', [set(true, 10)]), 'reps').startWeight).toBe(0);
  });
});

describe('appendSlot', () => {
  it('hängt ans Ende an, ohne die Eingabe zu ändern', () => {
    const before = JSON.stringify(template);
    const next = appendSlot(template, slot('n1', 't2b'));
    expect(next.slots.map((s) => s.id)).toEqual(['s1', 'n1']);
    expect(JSON.stringify(template)).toBe(before);
    expect(next).not.toBe(template);
  });
  it('keine doppelte id', () => {
    expect(appendSlot(template, slot('s1', 't2b'))).toBe(template);
  });
  it('keine doppelte Übung', () => {
    expect(appendSlot(template, slot('n1', 'dips'))).toBe(template);
  });
});

describe('suggest nach frei eingetragenem Eintrag', () => {
  const s = slotFromEntry(entry('n1', 'dips', [set(true, 10)]), 'weighted');

  it('Zusatzgewicht: erstes Mal mit dem Gewicht von damals', () => {
    const r = suggest({ ...s, startWeight: 0 }, 'weighted', [entry('n1', 'dips', [set(false, 7.5), set(true, 10), set(true, 10)])]);
    expect(r.kind).toBe('first');
    expect(r.weight).toBe(10);
    expect(r.reps).toEqual([6, 6, 6]);
    expect(r.label).toBe('Erstes Mal – Gewicht prüfen und anpassen');
  });
  it('ohne erledigten Satz mit Gewicht → Startgewicht', () => {
    const r = suggest({ ...s, startWeight: 5 }, 'weighted', [entry('n1', 'dips', [set(true, null)])]);
    expect(r.kind).toBe('first');
    expect(r.weight).toBe(5);
  });
  it('nur Wdh.: Gewicht null', () => {
    const r = suggest(slot('n1', 't2b'), 'reps', [entry('n1', 't2b', [set(true, null, 9)])]);
    expect(r.kind).toBe('first');
    expect(r.weight).toBeNull();
    expect(r.reps).toEqual([6, 6, 6]);
    expect(r.label).toBe('Erstes Mal – Startwerte');
  });
});
