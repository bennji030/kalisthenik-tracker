import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Exercise, type Session } from '../db';
import { LineChart } from '../components/LineChart';
import { entrySucceeded } from '../progression';
import { fmtDate, fmtShortDate, summarizeSets } from '../util';

export function History() {
  const [tab, setTab] = useState<'sessions' | 'exercises'>('sessions');
  const sessions = useLiveQuery(
    async () => (await db.sessions.toArray()).filter((s) => s.finishedAt).sort((a, b) => b.startedAt - a.startedAt),
    [],
  );
  const exercises = useLiveQuery(() => db.exercises.toArray(), []);
  if (!sessions || !exercises) return <div className="screen" />;
  const exMap = new Map(exercises.map((e) => [e.id, e]));

  return (
    <div className="screen">
      <h1>Verlauf</h1>
      <div className="seg">
        <button className={tab === 'sessions' ? 'on' : ''} onClick={() => setTab('sessions')}>Trainings</button>
        <button className={tab === 'exercises' ? 'on' : ''} onClick={() => setTab('exercises')}>Übungen</button>
      </div>
      {sessions.length === 0 && <p className="muted">Noch keine abgeschlossenen Trainings.</p>}
      {tab === 'sessions'
        ? sessions.map((s) => <SessionCard key={s.id} s={s} exMap={exMap} />)
        : <ExerciseList sessions={sessions} exercises={exercises} />}
    </div>
  );
}

function SessionCard({ s, exMap }: { s: Session; exMap: Map<string, Exercise> }) {
  const [open, setOpen] = useState(false);
  const [del, setDel] = useState(false);
  const mins = s.finishedAt ? Math.round((s.finishedAt - s.startedAt) / 60000) : 0;
  return (
    <section className="card">
      <button className="card-toggle" onClick={() => setOpen(!open)}>
        <div>
          <h2>{s.templateName}</h2>
          <p className="muted small">{fmtDate(s.startedAt, true)} · {mins} min</p>
        </div>
        <span className="muted">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <>
          <ul className="log">
            {s.entries.filter((e) => e.sets.some((x) => x.done)).map((e) => {
              const ex = exMap.get(e.exerciseId);
              const judged = e.kind !== 'free';
              return (
                <li key={e.slotId}>
                  <span>{judged ? (entrySucceeded(e) ? '✅' : '⚠️') : '·'} {ex?.name ?? '?'}</span>
                  <span className="muted">{summarizeSets(e.sets.filter((x) => x.done), ex?.type ?? 'reps')}</span>
                </li>
              );
            })}
          </ul>
          {!del ? (
            <button className="btn btn-small btn-ghost danger" onClick={() => setDel(true)}>Training löschen</button>
          ) : (
            <div className="row">
              <button className="btn btn-small btn-danger" onClick={() => db.sessions.delete(s.id)}>Wirklich löschen</button>
              <button className="btn btn-small" onClick={() => setDel(false)}>Abbrechen</button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function ExerciseList({ sessions, exercises }: { sessions: Session[]; exercises: Exercise[] }) {
  const [sel, setSel] = useState<string | null>(null);
  const used = exercises.filter((ex) => sessions.some((s) => s.entries.some((e) => e.exerciseId === ex.id && e.sets.some((x) => x.done))));
  const ex = used.find((e) => e.id === sel);

  if (ex) {
    const rows = sessions
      .flatMap((s) => s.entries.filter((e) => e.exerciseId === ex.id).map((e) => ({ s, e, sets: e.sets.filter((x) => x.done) })))
      .filter((r) => r.sets.length)
      .sort((a, b) => a.s.startedAt - b.s.startedAt);
    const metric = (sets: typeof rows[number]['sets']) =>
      ex.type === 'weighted' ? Math.max(...sets.map((x) => x.weight ?? 0))
        : ex.type === 'hold' ? Math.max(...sets.map((x) => x.sec ?? 0))
          : sets.reduce((n, x) => n + (x.reps ?? 0), 0);
    const unit = ex.type === 'weighted' ? 'kg' : ex.type === 'hold' ? 's (bester Satz)' : 'Wdh. gesamt';
    const volume = (sets: typeof rows[number]['sets']) => sets.reduce((n, x) => n + (x.reps ?? 0), 0);
    return (
      <>
        <button className="btn btn-ghost" onClick={() => setSel(null)}>‹ Alle Übungen</button>
        <section className="card">
          <h2>{ex.name}</h2>
          <p className="muted small">{unit}</p>
          <LineChart unit={unit} points={rows.map((r) => ({ x: r.s.startedAt, y: metric(r.sets), label: fmtShortDate(r.s.startedAt) }))} />
          {ex.type === 'weighted' && (
            <>
              <p className="muted small">Wiederholungen gesamt</p>
              <LineChart unit="Wdh." points={rows.map((r) => ({ x: r.s.startedAt, y: volume(r.sets), label: fmtShortDate(r.s.startedAt) }))} />
            </>
          )}
          <ul className="log">
            {[...rows].reverse().map((r) => (
              <li key={r.s.id + r.e.slotId}>
                <span>{fmtDate(r.s.startedAt)}</span>
                <span className="muted">{summarizeSets(r.sets, ex.type)}</span>
              </li>
            ))}
          </ul>
        </section>
      </>
    );
  }

  return (
    <ul className="list">
      {used.map((e) => (
        <li key={e.id}><button onClick={() => setSel(e.id)}>{e.name}<span className="muted">›</span></button></li>
      ))}
    </ul>
  );
}
