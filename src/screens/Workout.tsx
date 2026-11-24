import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getMeta, type EntryLog, type Exercise, type ExType, type Session, type SetLog } from '../db';
import { addedEntry, appendSlot, isAdded, planQuestions, slotFromEntry } from '../addedExercise';
import { NumInput } from '../components/NumInput';
import { RestTimer, beep, successSound, unlockAudio } from '../components/RestTimer';
import { parseTrainingPrefs } from '../lockScreen';
import { entryDayFor, entryNoon, entryTimes } from '../entryDay';
import { backdatedLabel, flameGain, sessionStats, trainingNumber, type FinishStats } from '../finishSummary';
import { strengthOnly } from '../cardio';
import { REPS_STEP, SEC_STEP, stepValue, weightStep } from '../stepper';
import { ENTRY_DAY_KEY, type EntryDay } from '../sessions';
import { fmtAddedKg, fmtDate, fmtKg, uid } from '../util';
import { TYPE_LABEL } from './PlanEditor';

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

interface Summary {
  name: string;
  number: number;
  backdated: string | null;
  stats: FinishStats;
  flames: number;
  gain: number;
}

export function Workout({ sessionId, onClose, onDone }: { sessionId: string; onClose: (msg?: string) => void; onDone: () => void }) {
  const [session, setSession] = useState<Session | null>(null);
  const [rest, setRest] = useState(loadRest);
  const [confirm, setConfirm] = useState<null | 'finish' | 'discard'>(null);
  const [adding, setAdding] = useState(false);
  // Nach dem Speichern: Fragen zu hinzugefügten Übungen, eine nach der anderen.
  const [questions, setQuestions] = useState<{ list: EntryLog[]; i: number } | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const exercises = useLiveQuery(() => db.exercises.toArray(), []);
  const exMap = new Map((exercises ?? []).map((e) => [e.id, e]));
  const template = useLiveQuery(async () => (session ? db.templates.get(session.templateId) : undefined), [session?.templateId]);
  const entry = useLiveQuery(() => getMeta<EntryDay | null>(ENTRY_DAY_KEY, null), []);
  const entryDay = entryDayFor(entry, sessionId);
  const first = useRef(true);
  const prefsRaw = useLiveQuery(async () => ({ value: await getMeta<unknown>('training', undefined) }), []);
  const prefs = parseTrainingPrefs(prefsRaw?.value);

  useEffect(() => {
    void db.sessions.get(sessionId).then((s) => setSession(s ?? null));
  }, [sessionId]);

  // Jede Änderung sofort speichern.
  useEffect(() => {
    if (!session) return;
    if (first.current) { first.current = false; return; }
    void db.sessions.put(session);
  }, [session]);

  const success = summary != null && !questions;
  useEffect(() => { if (success && prefs.restSound) successSound(); }, [success]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const addExercise = (ex: Exercise) => {
    setSession((s) => s && { ...s, entries: [...s.entries, addedEntry(ex, uid())] });
    setAdding(false);
  };
  const createExercise = async (name: string, type: ExType) => {
    const n = name.trim();
    const ex = await db.transaction('rw', db.exercises, async () => {
      const found = (await db.exercises.toArray()).find((e) => e.name.trim().toLowerCase() === n.toLowerCase());
      if (found) return found;
      const created: Exercise = { id: uid(), name: n, type };
      await db.exercises.add(created);
      return created;
    });
    addExercise(ex);
  };
  const removeEntry = (ei: number) =>
    setSession((s) => s && { ...s, entries: s.entries.filter((_, i) => i !== ei) });

  const doneSets = session.entries.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
  const totalSets = session.entries.reduce((n, e) => n + e.sets.length, 0);
  const mins = Math.round((Date.now() - session.startedAt) / 60000);

  const finish = async () => {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      const now = Date.now();
      let s: Session = { ...session, finishedAt: now };
      let backdated = false;
      await db.transaction('rw', db.sessions, db.meta, async () => {
        const e = await getMeta<EntryDay | null>(ENTRY_DAY_KEY, null);
        if (e?.sessionId === session.id) {
          const day = entryDayFor(e, session.id);
          if (day) { s = { ...session, ...entryTimes(day, session.startedAt, now) }; backdated = true; }
          await db.meta.delete(ENTRY_DAY_KEY);
        }
        await db.sessions.put(s);
      });
      setRestTimer(null);
      const [all, templates] = await Promise.all([db.sessions.toArray(), db.templates.toArray()]);
      const f = flameGain(all, s.id, strengthOnly(templates).length, now);
      setSummary({
        name: s.templateName,
        number: trainingNumber(all),
        backdated: backdated ? backdatedLabel(s.startedAt) : null,
        stats: sessionStats(s),
        flames: f.after,
        gain: f.gain,
      });
      const list = planQuestions(s, template);
      if (list.length) setQuestions({ list, i: 0 });
    } catch {
      setError('Speichern fehlgeschlagen, bitte nochmal.');
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };
  const answer = async (yes: boolean) => {
    if (!questions || busy.current) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      const e = questions.list[questions.i];
      const ex = exMap.get(e.exerciseId);
      if (yes && ex) {
        await db.transaction('rw', db.templates, async () => {
          const t = await db.templates.get(session.templateId);
          if (t) await db.templates.put(appendSlot(t, slotFromEntry(e, ex.type)));
        });
      }
      setQuestions(questions.i + 1 < questions.list.length ? { ...questions, i: questions.i + 1 } : null);
    } catch {
      setError('Speichern fehlgeschlagen, bitte nochmal.');
    } finally {
      busy.current = false;
      setSaving(false);
    }
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

  if (success) return <FinishCard s={summary} onDone={onDone} />;

  return (
    <div className="screen workout">
      <header className="wo-head">
        <div>
          <h1>{session.templateName}</h1>
          {entryDay && <p className="muted small">für {fmtDate(entryNoon(entryDay), true)}</p>}
          <p className="muted small">{doneSets}/{totalSets} Sätze · {mins} min</p>
        </div>
        {!questions && <button className="btn btn-ghost" onClick={() => onClose()}>Zurück</button>}
      </header>

      {questions ? (
        <section className="card">
          <h2>{exMap.get(questions.list[questions.i].exerciseId)?.name} künftig auch in {template?.name ?? session.templateName}?</h2>
          <p className="muted small">Kommt ans Ende des Trainingstags, Werte änderst du im Plan.</p>
          <div className="row">
            <button className="btn btn-primary wo-answer" disabled={saving} onClick={() => answer(true)}>Ja</button>
            <button className="btn wo-answer" disabled={saving} onClick={() => answer(false)}>Nein</button>
          </div>
          {error && <p className="wo-error small" role="alert">{error}</p>}
        </section>
      ) : (<>
      <div className="cards">
      {session.entries.map((e, ei) => {
        const ex = exMap.get(e.exerciseId);
        if (!ex) return null;
        return (
          <ExerciseCard
            key={e.slotId}
            entry={e}
            ex={ex}
            increment={template?.slots.find((sl) => sl.id === e.slotId)?.increment}
            onSet={(si, p) => updateSet(ei, si, p)}
            onToggle={(si) => toggleDone(ei, si)}
            onAdd={() => addSet(ei)}
            onRemove={() => removeSet(ei)}
            onDelete={template && isAdded(e, template) ? () => removeEntry(ei) : undefined}
          />
        );
      })}
      </div>

      <div className="wo-actions">
        {confirm === null && (
          <>
            {adding ? (
              <AddExercise exercises={exercises} onPick={addExercise} onCreate={createExercise} onCancel={() => setAdding(false)} />
            ) : (
              <button className="btn wo-add" onClick={() => setAdding(true)}>+ Übung</button>
            )}
            <button className="btn btn-primary btn-big" onClick={() => setConfirm('finish')}>Training beenden</button>
            <button className="btn btn-ghost danger" onClick={() => setConfirm('discard')}>Training verwerfen</button>
          </>
        )}
        {confirm === 'finish' && (
          <div className="confirm">
            <p>{doneSets < totalSets ? `${totalSets - doneSets} Sätze nicht abgehakt – die zählen als nicht geschafft.` : 'Alles abgehakt. Speichern?'}</p>
            <div className="row">
              <button className="btn btn-primary" disabled={saving} onClick={() => { unlockAudio(); void finish(); }}>Speichern</button>
              <button className="btn" disabled={saving} onClick={() => { setError(null); setConfirm(null); }}>Abbrechen</button>
            </div>
            {error && <p className="wo-error small" role="alert">{error}</p>}
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
      </>)}

      {rest && <RestTimer endAt={rest.endAt} total={rest.total} onChange={setRestTimer} onEnd={() => { if (prefs.restSound) beep(); }} />}
    </div>
  );
}

function FinishCard({ s, onDone }: { s: Summary; onDone: () => void }) {
  const { stats } = s;
  return (
    <div className="screen workout">
      <section className="card finish-card">
        <h1>{s.backdated ? `Training Nr. ${s.number} für ${s.backdated} eingetragen` : `Training Nr. ${s.number} erfolgreich absolviert`}</h1>
        <p className="finish-name">{s.name}</p>
        <ul className="finish-stats">
          <li><b>{stats.minutes.toLocaleString('de-DE')}</b> min</li>
          <li><b>{stats.sets.toLocaleString('de-DE')}</b> {stats.sets === 1 ? 'Satz' : 'Sätze'}</li>
          <li><b>{stats.reps.toLocaleString('de-DE')}</b> {stats.reps === 1 ? 'Wiederholung' : 'Wiederholungen'}</li>
          {stats.judged > 0 && <li><b>{stats.hits}/{stats.judged}</b> Ziele geschafft</li>}
        </ul>
        <div className="streak finish-flames" role="img"
          aria-label={`${s.flames} Training${s.flames === 1 ? '' : 's'} in Folge${s.gain > 0 ? `, ${s.gain} mehr` : ''}`}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
            <path d="M19.48 12.35c-1.57-4.08-7.16-4.3-5.81-10.23.1-.44-.37-.78-.75-.55C9.29 3.71 6.68 8 8.87 13.62c.18.46-.36.89-.75.59-1.81-1.37-2-3.34-1.84-4.75.06-.52-.62-.77-.91-.34C4.69 10.16 4 11.84 4 14.37c.38 5.6 5.11 7.32 6.81 7.54 2.43.31 5.06-.14 6.95-1.87 2.08-1.93 2.84-5.01 1.72-7.69z" />
          </svg>
          <span>{s.flames}</span>
          {s.gain > 0 && <span className="finish-gain">+{s.gain}</span>}
        </div>
        <button className="btn btn-primary btn-big" onClick={onDone}>Fertig</button>
      </section>
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
  increment: number | null | undefined;
  onSet: (si: number, p: Partial<SetLog>) => void;
  onToggle: (si: number) => void;
  onAdd: () => void;
  onRemove: () => void;
  onDelete?: () => void; // nur für im Training hinzugefügte Übungen
}

function ExerciseCard({ entry, ex, increment, onSet, onToggle, onAdd, onRemove, onDelete }: CardProps) {
  const [confirmDel, setConfirmDel] = useState(false);
  const t = ex.type;
  const allDone = entry.sets.length > 0 && entry.sets.every((s) => s.done);
  const hasTarget = entry.sets.some((s) => s.targetReps != null);
  const [picked, setPicked] = useState<number | null>(null);
  const firstOpen = entry.sets.findIndex((s) => !s.done);
  const active = picked != null && picked < entry.sets.length ? picked : firstOpen;
  const wStep = weightStep(increment);
  const toggle = (si: number) => {
    if (si === active) setPicked(null);
    onToggle(si);
  };
  const step = (label: string, text: ReactNode, field: 'weight' | 'reps' | 'sec', delta: number) => (
    <button key={label} className="step-btn" aria-label={`Satz ${active + 1} ${label}`}
      onClick={() => onSet(active, { [field]: stepValue(entry.sets[active][field], delta) })}>{text}</button>
  );
  return (
    <section className={`card ex-card ${allDone ? 'ex-done' : ''}`}>
      <div className="ex-head">
        <h2>{ex.name}</h2>
        {onDelete && !confirmDel && (
          <button className="btn btn-small btn-ghost danger ex-del"
            onClick={() => (entry.sets.some((s) => s.done) ? setConfirmDel(true) : onDelete())}>Entfernen</button>
        )}
      </div>
      {onDelete && confirmDel && (
        <div className="confirm confirm-inset">
          <p>Übung entfernen? Erledigte Sätze gehen verloren.</p>
          <div className="row">
            <button className="btn btn-danger" onClick={onDelete}>Entfernen</button>
            <button className="btn" onClick={() => setConfirmDel(false)}>Abbrechen</button>
          </div>
        </div>
      )}
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
            <Fragment key={si}>
            <div className={`set-row ${s.done ? (missed ? 'set-missed' : 'set-done') : ''}`} onFocusCapture={() => setPicked(si)}>
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
              <button className={`check ${s.done ? 'checked' : ''}`} onClick={() => toggle(si)} aria-label={`Satz ${si + 1} erledigt`}>✓</button>
            </div>
            {si === active && (
              <div className={`step-row ${hasTarget ? 'step-target' : ''}`}>
                {t === 'weighted' && (
                  <div className="step-pair step-kg">
                    {step(`Gewicht minus ${fmtKg(wStep)} kg`, <>−{fmtKg(wStep)}<span className="step-unit"> kg</span></>, 'weight', -wStep)}
                    {step(`Gewicht plus ${fmtKg(wStep)} kg`, <>+{fmtKg(wStep)}<span className="step-unit"> kg</span></>, 'weight', wStep)}
                  </div>
                )}
                <div className="step-pair step-main">
                  {t === 'hold' ? <>
                    {step(`Sekunden minus ${SEC_STEP}`, `−${SEC_STEP} s`, 'sec', -SEC_STEP)}
                    {step(`Sekunden plus ${SEC_STEP}`, `+${SEC_STEP} s`, 'sec', SEC_STEP)}
                  </> : <>
                    {step(`Wiederholungen minus ${REPS_STEP}`, `−${REPS_STEP}`, 'reps', -REPS_STEP)}
                    {step(`Wiederholungen plus ${REPS_STEP}`, `+${REPS_STEP}`, 'reps', REPS_STEP)}
                  </>}
                </div>
              </div>
            )}
            </Fragment>
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

const NEW_TYPE_LABEL: Record<ExType, string> = { weighted: 'Zusatzgewicht', reps: 'Wiederholungen', hold: 'Halten' };

interface AddProps {
  exercises: Exercise[];
  onPick: (ex: Exercise) => void;
  onCreate: (name: string, type: ExType) => Promise<void>;
  onCancel: () => void;
}

function AddExercise({ exercises, onPick, onCreate, onCancel }: AddProps) {
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<ExType>('reps');
  const q = query.trim().toLowerCase();
  const list = exercises
    .filter((e) => e.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  return (
    <section className="card add-ex">
      <h2>Übung hinzufügen</h2>
      <input className="add-search" type="search" placeholder="Übung suchen" value={query}
        onChange={(e) => setQuery(e.target.value)} aria-label="Übung suchen" />
      {list.length ? (
        <ul className="pick-list">
          {list.map((e) => (
            <li key={e.id}>
              <button className="pick-row" onClick={() => onPick(e)}>
                <span className="pick-name">{e.name}</span>
                <span className="muted small">{TYPE_LABEL[e.type]}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted small">Keine Übung gefunden.</p>
      )}
      <div className="lib-new">
        <h3 className="add-sub">Neue Übung</h3>
        <input placeholder="Name, z. B. Toes to Bar" value={name} onChange={(e) => setName(e.target.value)} aria-label="Name der neuen Übung" />
        <select value={type} onChange={(e) => setType(e.target.value as ExType)} aria-label="Art der neuen Übung">
          {(Object.keys(NEW_TYPE_LABEL) as ExType[]).map((k) => <option key={k} value={k}>{NEW_TYPE_LABEL[k]}</option>)}
        </select>
        <button className="btn btn-primary" disabled={!name.trim()} onClick={() => void onCreate(name, type)}>Anlegen</button>
      </div>
      <button className="btn" onClick={onCancel}>Abbrechen</button>
    </section>
  );
}
