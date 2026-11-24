import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, saveWeight, type Exercise, type Session } from '../db';
import { LineChart } from '../components/LineChart';
import { NumInput } from '../components/NumInput';
import { WeightStats } from '../components/Weight';
import { SessionLog } from '../components/SessionLog';
import { cardioSummary, isCardioSession } from '../cardio';
import { fmtDate, fmtShortDate, summarizeSets } from '../util';
import { dayTs, fmtWeight, isValidKg, rollingAverages, type WeightPoint } from '../weight';

export type HistoryTab = 'sessions' | 'exercises' | 'weights';

export function History({ initialTab = 'sessions' }: { initialTab?: HistoryTab }) {
  const [tab, setTab] = useState<HistoryTab>(initialTab);
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
        <button className={tab === 'weights' ? 'on' : ''} onClick={() => setTab('weights')}>Gewicht</button>
      </div>
      {tab !== 'weights' && sessions.length === 0 && <p className="muted">Noch keine abgeschlossenen Trainings.</p>}
      {tab === 'sessions'
        ? <div className="cards">{sessions.map((s) => <SessionCard key={s.id} s={s} exMap={exMap} />)}</div>
        : tab === 'exercises'
          ? <ExerciseList sessions={sessions} exercises={exercises} />
          : <WeightHistory />}
    </div>
  );
}

function SessionCard({ s, exMap }: { s: Session; exMap: Map<string, Exercise> }) {
  const [open, setOpen] = useState(false);
  const [del, setDel] = useState(false);
  const mins = s.finishedAt ? Math.round((s.finishedAt - s.startedAt) / 60000) : 0;
  const cardio = isCardioSession(s);
  return (
    <section className="card">
      <button className="card-toggle" onClick={() => setOpen(!open)}>
        <div>
          <h2>{s.templateName}</h2>
          <p className="muted small">{fmtDate(s.startedAt, true)} · {cardio ? cardioSummary(s) : `${mins} min`}</p>
        </div>
        <span className="muted">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <>
          {!cardio && <SessionLog entries={s.entries} exMap={exMap} />}
          {!del ? (
            <button className="btn btn-small btn-ghost danger" onClick={() => setDel(true)}>Training löschen</button>
          ) : (
            <div className="row" data-no-swipe>
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

function WeightHistory() {
  const weights = useLiveQuery(() => db.weights.toArray(), []);
  if (!weights) return null;
  if (weights.length === 0) return <p className="muted">Noch kein Gewicht eingetragen.</p>;
  const rolling = rollingAverages(weights);
  const label = (date: string) => fmtShortDate(dayTs(date));
  return (
    <>
      <section className="card readable">
        <WeightStats entries={weights} />
        <LineChart
          unit="kg"
          points={rolling.map((r) => ({ x: dayTs(r.date), y: r.kg, label: label(r.date) }))}
          line={rolling.map((r) => ({ x: dayTs(r.date), y: r.avg, label: label(r.date) }))}
          legend={{ points: 'Tageswert', line: '7-Tage-Schnitt' }}
          emptyText="Ab zwei Einträgen gibt es hier eine Kurve."
        />
      </section>
      <ul className="list">
        {[...rolling].reverse().map((r) => <WeightRow key={r.date} r={r} />)}
      </ul>
    </>
  );
}

function WeightRow({ r }: { r: WeightPoint }) {
  const [edit, setEdit] = useState(false);
  const [del, setDel] = useState(false);
  const [kg, setKg] = useState<number | null>(r.kg);
  const close = () => { setEdit(false); setDel(false); };

  if (!edit) {
    return (
      <li>
        <button onClick={() => { setKg(r.kg); setEdit(true); }}>
          <span>{fmtDate(dayTs(r.date), true)}</span>
          <span className="weight-val">{fmtWeight(r.kg)} kg <span className="muted">Ø {fmtWeight(r.avg)}</span></span>
        </button>
      </li>
    );
  }
  return (
    <li className="weight-edit">
      <p>{fmtDate(dayTs(r.date), true)}</p>
      <div className="row">
        <NumInput value={kg} onChange={setKg} decimal placeholder="kg" ariaLabel="Gewicht in kg" className="num weight-num" />
        <button className="btn btn-small btn-primary" disabled={!isValidKg(kg)} onClick={async () => { await saveWeight(r.date, kg!); close(); }}>Speichern</button>
        <button className="btn btn-small" onClick={close}>Abbrechen</button>
      </div>
      <div className="row" data-no-swipe>
        {!del ? (
          <button className="btn btn-small btn-ghost danger" onClick={() => setDel(true)}>Löschen</button>
        ) : (
          <>
            <button className="btn btn-small btn-danger" onClick={() => db.weights.delete(r.date)}>Wirklich löschen</button>
            <button className="btn btn-small" onClick={() => setDel(false)}>Abbrechen</button>
          </>
        )}
      </div>
    </li>
  );
}
