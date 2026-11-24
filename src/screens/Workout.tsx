import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getMeta, type EntryLog, type Exercise, type Session, type SetLog } from '../db';
import { NumInput } from '../components/NumInput';
import { RestTimer, unlockAudio } from '../components/RestTimer';
import { entryDayFor, entryNoon, entryTimes } from '../entryDay';
import { entrySucceeded } from '../progression';
import { ENTRY_DAY_KEY, type EntryDay } from '../sessions';
import { fmtAddedKg, fmtDate, fmtKg } from '../util';

const KIND_CLASS: Record<string, string> = {
  'up-reps': 'pill-up', 'up-weight': 'pill-up', first: 'pill-neutral', repeat: 'pill-warn',
  deload: 'pill-warn', maxed: 'pill-up', free: 'pill-neutral',
};

function loadRest(): { endAt: number; total: number } | null {
  try {
    const r = JSON.parse(localStorage.getItem('rest') ?? 'null');
    return r && r.endAt > Date.now() - 5000 ? r : null;
  } catch {
    return null;
  }
}
function saveRest(r: { endAt: number; total: number } | null) {
  try {
    if (r) localStorage.setItem('rest', JSON.stringify(r));
    else localStorage.removeItem('rest');
  } catch { /* egal */ }
}

export function Workout({ sessionId, onClose }: { sessionId: string; onClose: (msg?: string) => void }) {
  const [session, setSession] = useState<Session | null>(null);
  const [rest, setRest] = useState(loadRest);
  const [confirm, setConfirm] = useState<null | 'finish' | 'discard'>(null);
  const exercises = useLiveQuery(() => db.exercises.toArray(), []);
  const exMap = new Map((exercises ?? []).map((e) => [e.id, e]));
  const entry = useLiveQuery(() => getMeta<EntryDay | null>(ENTRY_DAY_KEY, null), []);
  const entryDay = entryDayFor(entry, sessionId);
  const first = useRef(true);

  useEffect(() => {
    void db.sessions.get(sessionId).then((s) => setSession(s ?? null));
  }, [sessionId]);

  // Jede Änderung sofort speichern.
  useEffect(() => {
    if (!session) return;
    if (first.current) { first.current = false; return; }
    void db.sessions.put(session);
  }, [session]);

  // Bildschirm während des Trainings anlassen.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const get = async () => {
      try { lock = await navigator.wakeLock?.request('screen'); } catch { /* nicht unterstützt */ }
    };
    const onVis = () => document.visibilityState === 'visible' && void get();
    void get();
    document.addEventListener('visibilitychange', onVis);
    return () => { document.removeEventListener('visibilitychange', onVis); void lock?.release(); };
  }, []);

  if (!session || !exercises) return <div className="screen"><p className="muted">Lade …</p></div>;

  const updateEntry = (ei: number, fn: (e: EntryLog) => EntryLog) =>
    setSession((s) => s && { ...s, entries: s.entries.map((e, i) => (i === ei ? fn(e) : e)) });

  const updateSet = (ei: number, si: number, patch: Partial<SetLog>) =>
    updateEntry(ei, (e) => ({ ...e, sets: e.sets.map((st, i) => (i === si ? { ...st, ...patch } : st)) }));

  const setRestTimer = (endAt: number | null, total?: number) => {
    const r = endAt == null ? null : { endAt, total: total ?? rest?.total ?? 0 };
    setRest(r);
    saveRest(r);
  };

  const toggleDone = (ei: number, si: number) => {
    unlockAudio();
    const e = session.entries[ei];
    const st = e.sets[si];
    const done = !st.done;
    // Weiterreichen: geändertes Gewicht in die folgenden, noch offenen Sätze übernehmen.
    updateEntry(ei, (en) => ({
      ...en,
      sets: en.sets.map((x, i) => {
        if (i === si) return { ...x, done };
        if (done && i > si && !x.done && st.weight != null && x.weight === x.targetWeight) return { ...x, weight: st.weight };
        return x;
      }),
    }));
    if (done && e.restSec > 0) setRestTimer(Date.now() + e.restSec * 1000, e.restSec);
  };

  const addSet = (ei: number) =>
    updateEntry(ei, (e) => {
      const lastSet = e.sets[e.sets.length - 1];
      return { ...e, sets: [...e.sets, { ...(lastSet ?? emptySet()), targetReps: null, targetWeight: null, done: false }] };
    });
  const removeSet = (ei: number) =>
    updateEntry(ei, (e) => ({ ...e, sets: e.sets.slice(0, Math.max(0, e.sets.length - 1)) }));

  const doneSets = session.entries.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
  const totalSets = session.entries.reduce((n, e) => n + e.sets.length, 0);
  const mins = Math.round((Date.now() - session.startedAt) / 60000);

  const finish = async () => {
    const now = Date.now();
    let s: Session = { ...session, finishedAt: now };
    await db.transaction('rw', db.sessions, db.meta, async () => {
      const e = await getMeta<EntryDay | null>(ENTRY_DAY_KEY, null);
      if (e?.sessionId === session.id) {
        const day = entryDayFor(e, session.id);
        if (day) s = { ...session, ...entryTimes(day, session.startedAt, now) };
        await db.meta.delete(ENTRY_DAY_KEY);
      }
      await db.sessions.put(s);
    });
    setRestTimer(null);
    const hits = s.entries.filter((e) => e.kind !== 'free' && entrySucceeded(e)).length;
    const judged = s.entries.filter((e) => e.kind !== 'free').length;
    onClose(`Gespeichert · ${hits}/${judged} Ziele geschafft 💪`);
  };
  const discard = async () => {
    await db.transaction('rw', db.sessions, db.meta, async () => {
      const e = await getMeta<EntryDay | null>(ENTRY_DAY_KEY, null);
      if (e?.sessionId === session.id) await db.meta.delete(ENTRY_DAY_KEY);
      await db.sessions.delete(session.id);
    });
    setRestTimer(null);
    onClose('Training verworfen');
  };

  return (
    <div className="screen workout">
      <header className="wo-head">
        <div>
          <h1>{session.templateName}</h1>
          {entryDay && <p className="muted small">für {fmtDate(entryNoon(entryDay), true)}</p>}
          <p className="muted small">{doneSets}/{totalSets} Sätze · {mins} min</p>
        </div>
        <button className="btn btn-ghost" onClick={() => onClose()}>Zurück</button>
      </header>

      <div className="cards">
      {session.entries.map((e, ei) => {
        const ex = exMap.get(e.exerciseId);
        if (!ex) return null;
        return (
          <ExerciseCard
            key={e.slotId}
            entry={e}
            ex={ex}
            onSet={(si, p) => updateSet(ei, si, p)}
            onToggle={(si) => toggleDone(ei, si)}
            onAdd={() => addSet(ei)}
            onRemove={() => removeSet(ei)}
          />
        );
      })}
      </div>

      <div className="wo-actions">
        {confirm === null && (
          <>
            <button className="btn btn-primary btn-big" onClick={() => setConfirm('finish')}>Training beenden</button>
            <button className="btn btn-ghost danger" onClick={() => setConfirm('discard')}>Training verwerfen</button>
          </>
        )}
        {confirm === 'finish' && (
          <div className="confirm">
            <p>{doneSets < totalSets ? `${totalSets - doneSets} Sätze nicht abgehakt – die zählen als nicht geschafft.` : 'Alles abgehakt. Speichern?'}</p>
            <div className="row">
              <button className="btn btn-primary" onClick={finish}>Speichern</button>
              <button className="btn" onClick={() => setConfirm(null)}>Abbrechen</button>
            </div>
          </div>
        )}
        {confirm === 'discard' && (
          <div className="confirm">
            <p>Training wirklich löschen? Das geht nicht rückgängig.</p>
            <div className="row">
              <button className="btn btn-danger" onClick={discard}>Löschen</button>
              <button className="btn" onClick={() => setConfirm(null)}>Abbrechen</button>
            </div>
          </div>
        )}
      </div>

      {rest && <RestTimer endAt={rest.endAt} total={rest.total} onChange={setRestTimer} />}
    </div>
  );
}

function emptySet(): SetLog {
  return { targetReps: null, targetWeight: null, targetSec: null, reps: null, weight: null, sec: null, done: false };
}

function targetText(s: SetLog, type: Exercise['type']): ReactNode {
  if (s.targetReps == null) return '–';
  if (type === 'weighted' && s.targetWeight) return <>{s.targetReps} × <span className="nowrap">{fmtAddedKg(s.targetWeight)}</span></>;
  return `${s.targetReps}`;
}

interface CardProps {
  entry: EntryLog;
  ex: Exercise;
  onSet: (si: number, p: Partial<SetLog>) => void;
  onToggle: (si: number) => void;
  onAdd: () => void;
  onRemove: () => void;
}

function ExerciseCard({ entry, ex, onSet, onToggle, onAdd, onRemove }: CardProps) {
  const t = ex.type;
  const allDone = entry.sets.length > 0 && entry.sets.every((s) => s.done);
  const hasTarget = entry.sets.some((s) => s.targetReps != null);
  return (
    <section className={`card ex-card ${allDone ? 'ex-done' : ''}`}>
      <h2>{ex.name}</h2>
      {entry.lastSummary && <p className="muted small">Letztes Mal: {entry.lastSummary}</p>}
      <p className={`pill ${KIND_CLASS[entry.kind]}`}>{entry.label}</p>

      <div className={`sets sets-${t}`}>
        <div className="set-row set-head">
          <span>Satz</span>
          {hasTarget && <span>Ziel</span>}
          {t === 'weighted' && <span>kg</span>}
          {t === 'hold' ? <span>Sek.</span> : <span>Wdh.</span>}
          <span />
        </div>
        {entry.sets.map((s, si) => {
          const missed = s.done && s.targetReps != null && ((s.reps ?? 0) < s.targetReps || (s.weight ?? 0) < (s.targetWeight ?? 0));
          return (
            <div key={si} className={`set-row ${s.done ? (missed ? 'set-missed' : 'set-done') : ''}`}>
              <span className="set-no">{si + 1}</span>
              {hasTarget && <span className="set-target">{targetText(s, t)}</span>}
              {t === 'weighted' && (
                <NumInput decimal value={s.weight} onChange={(v) => onSet(si, { weight: v })} ariaLabel={`Satz ${si + 1} Gewicht`} />
              )}
              {t === 'hold' ? (
                <NumInput value={s.sec} onChange={(v) => onSet(si, { sec: v })} placeholder="s" ariaLabel={`Satz ${si + 1} Sekunden`} />
              ) : (
                <NumInput value={s.reps} onChange={(v) => onSet(si, { reps: v })} ariaLabel={`Satz ${si + 1} Wiederholungen`} />
              )}
              <button className={`check ${s.done ? 'checked' : ''}`} onClick={() => onToggle(si)} aria-label={`Satz ${si + 1} erledigt`}>✓</button>
            </div>
          );
        })}
      </div>
      <div className="row small-row">
        <button className="btn btn-small" onClick={onAdd}>+ Satz</button>
        {entry.sets.length > 0 && <button className="btn btn-small" onClick={onRemove}>− Satz</button>}
        {entry.restSec > 0 && <span className="muted small push-right">Pause {fmtKg(entry.restSec / 60)} min</span>}
      </div>
    </section>
  );
}
