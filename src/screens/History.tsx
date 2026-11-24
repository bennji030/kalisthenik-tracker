import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getMeta, saveWeight, type DayValues, type Exercise, type Session, type Template } from '../db';
import { BarChart } from '../components/BarChart';
import { LineChart } from '../components/LineChart';
import { NumInput } from '../components/NumInput';
import { WeightStats } from '../components/Weight';
import { SessionLog } from '../components/SessionLog';
import { cardioOnly, cardioSummary, isCardioSession, strengthOnly } from '../cardio';
import { parseGoals } from '../dayValues';
import { cardioWeeks, dayBars, weightWeek, weightWeekChange } from '../statsCharts';
import { exerciseGroup, exerciseOrder, exerciseWindow, fmtChange, GROUPS, WINDOW, windowChange } from '../stats';
import type { DayView } from './DayValues';
import { fmtDate, fmtInt, fmtShortDate, summarizeSets, WEEKDAYS } from '../util';
import { dayTs, fmtDelta, fmtWeight, isValidKg, rollingAverages, type WeightPoint } from '../weight';

export type HistoryTab = 'training' | 'nutrition' | 'cardio' | 'sessions' | 'weight';

export function History({ initialTab = 'training', goDay }: { initialTab?: HistoryTab; goDay: (v: DayView) => void }) {
  const [tab, setTab] = useState<HistoryTab>(initialTab);
  const sessions = useLiveQuery(
    async () => (await db.sessions.toArray()).filter((s) => s.finishedAt).sort((a, b) => b.startedAt - a.startedAt),
    [],
  );
  const exercises = useLiveQuery(() => db.exercises.toArray(), []);
  const templates = useLiveQuery(() => db.templates.toArray(), []);
  if (!sessions || !exercises || !templates) return <div className="screen" />;
  const exMap = new Map(exercises.map((e) => [e.id, e]));
  const seg = tab === 'sessions' ? 'training' : tab === 'weight' ? 'nutrition' : tab;

  return (
    <div className="screen">
      <h1>Statistik</h1>
      <div className="seg">
        <button className={seg === 'training' ? 'on' : ''} onClick={() => setTab('training')}>Training</button>
        <button className={seg === 'nutrition' ? 'on' : ''} onClick={() => setTab('nutrition')}>Ernährung</button>
        <button className={seg === 'cardio' ? 'on' : ''} onClick={() => setTab('cardio')}>Cardio</button>
      </div>
      {tab === 'sessions' ? (
        <>
          <button className="btn btn-ghost link-btn" onClick={() => setTab('training')}>‹ Statistik</button>
          <div className="cards">{sessions.map((s) => <SessionCard key={s.id} s={s} exMap={exMap} />)}</div>
        </>
      ) : tab === 'weight' ? (
        <>
          <button className="btn btn-ghost link-btn" onClick={() => setTab('nutrition')}>‹ Statistik</button>
          <WeightHistory />
        </>
      ) : tab === 'training'
        ? <TrainingStats sessions={strengthOnly(sessions)} exercises={exercises} templates={templates} openAll={() => setTab('sessions')} />
        : tab === 'cardio'
          ? <CardioList sessions={cardioOnly(sessions)} />
          : <NutritionStats openWeight={() => setTab('weight')} goDay={goDay} />}
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

function TrainingStats({ sessions, exercises, templates, openAll }: { sessions: Session[]; exercises: Exercise[]; templates: Template[]; openAll: () => void }) {
  const [sel, setSel] = useState<string | null>(null);
  const used = exerciseOrder(
    exercises.filter((ex) => sessions.some((s) => s.entries.some((e) => e.exerciseId === ex.id && e.sets.some((x) => x.done)))),
    templates,
  );
  const ex = used.find((e) => e.id === sel);

  if (ex) return <ExerciseDetail ex={ex} sessions={sessions} back={() => setSel(null)} />;

  if (used.length === 0) return <p className="muted">Noch keine abgeschlossenen Trainings.</p>;
  const groupOf = new Map(used.map((e) => [e.id, exerciseGroup(e.id, sessions, templates)]));
  return (
    <>
      {GROUPS.map(([g, title]) => {
        const items = used.filter((e) => groupOf.get(e.id) === g);
        if (items.length === 0) return null;
        return (
          <section key={g} className="stat-group">
            <h2 className="stat-heading">{title}</h2>
            <div className="cards">{items.map((e) => <ExerciseCard key={e.id} ex={e} sessions={sessions} open={() => setSel(e.id)} />)}</div>
          </section>
        );
      })}
      <button className="btn btn-ghost link-btn" onClick={openAll}>Alle Trainings</button>
    </>
  );
}

function ExerciseCard({ ex, sessions, open }: { ex: Exercise; sessions: Session[]; open: () => void }) {
  const win = exerciseWindow(sessions, ex);
  const change = windowChange(win);
  const sub = win.length === 1 ? 'Letztes Training' : win.length < WINDOW ? `Letzte ${win.length} Trainings` : `Letzte ${WINDOW} Trainings`;
  return (
    <button className="card stat-card" onClick={open}>
      <span className="stat-head">
        <span className="stat-name">
          <span className="stat-title">{ex.name}</span>
          <span className="muted small">{sub}</span>
        </span>
        {change !== null && <span className={`stat-change ${change > 0 ? 'up' : change < 0 ? 'down' : ''}`}>{fmtChange(change, ex.type)}</span>}
      </span>
      <LineChart unit={UNIT[ex.type]} pointLabels
        points={win.map((p, i) => ({ x: i, y: p.value, label: fmtShortDate(p.ts) }))}
        emptyText="Ab zwei Trainings gibt es hier eine Kurve." />
    </button>
  );
}

const UNIT = { weighted: 'kg', reps: 'Wdh.', hold: 's' } as const;

function ExerciseDetail({ ex, sessions, back }: { ex: Exercise; sessions: Session[]; back: () => void }) {
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
      <button className="btn btn-ghost link-btn" onClick={back}>‹ Statistik</button>
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

function NutritionStats({ openWeight, goDay }: { openWeight: () => void; goDay: (v: DayView) => void }) {
  const data = useLiveQuery(async () => ({
    weights: await db.weights.toArray(),
    days: await db.days.toArray(),
    goals: parseGoals(await getMeta<unknown>('goals', undefined)),
  }), []);
  if (!data) return null;
  const now = Date.now();
  const win = weightWeek(data.weights, now);
  const change = weightWeekChange(win);
  const newest = win[win.length - 1];
  const open = () => goDay('kcal');
  return (
    <div className="cards">
      <button className="card stat-card" onClick={openWeight}>
        <span className="stat-head">
          <span className="stat-name">
            <span className="stat-title">Körpergewicht</span>
            <span className="muted small">Letzte 7 Tage</span>
          </span>
          {newest && (
            <span className="stat-name stat-right">
              <span className="stat-title">{fmtWeight(newest.kg)} kg</span>
              {change !== null && <span className={`weight-delta ${change < 0 ? 'down' : ''}`}>{fmtDelta(change)}</span>}
            </span>
          )}
        </span>
        {win.length === 0 ? <p className="muted small">Noch kein Gewicht eingetragen.</p> : (
          <LineChart unit="kg" pointLabels
            points={win.map((e) => ({ x: dayTs(e.date), y: e.kg, label: fmtShortDate(dayTs(e.date)) }))}
            emptyText="Ab zwei Einträgen in den letzten 7 Tagen gibt es hier eine Kurve." />
        )}
      </button>
      <DayBarCard title="Kalorien" unit="kcal" field="kcal" hint="Noch keine Kalorien" days={data.days} goal={data.goals.kcal} now={now} open={open} />
      <DayBarCard title="Protein" unit="g" field="proteinG" hint="Noch kein Protein" days={data.days} goal={data.goals.proteinG} now={now} open={open} />
    </div>
  );
}

function DayBarCard({ title, unit, field, hint, days, goal, now, open }: {
  title: string; unit: string; field: 'kcal' | 'proteinG'; hint: string; days: DayValues[]; goal: number; now: number; open: () => void;
}) {
  const bars = dayBars(days, field, now);
  return (
    <button className="card stat-card" onClick={open}>
      <span className="stat-head">
        <span className="stat-name">
          <span className="stat-title">{title}</span>
          <span className="muted small">Letzte 7 Tage · Ziel {fmtInt(goal)} {unit}</span>
        </span>
      </span>
      {bars.every((b) => b.value === null)
        ? <p className="muted small">{hint} in den letzten 7 Tagen. Tippen zum Eintragen.</p>
        : <BarChart unit={unit} goal={goal} fmt={fmtInt} bars={bars.map((b) => ({ label: WEEKDAYS[new Date(dayTs(b.date)).getDay()], value: b.value }))} />}
    </button>
  );
}

function CardioList({ sessions }: { sessions: Session[] }) {
  if (sessions.length === 0) return <p className="muted">Noch keine Cardio-Einträge. Abhaken geht auf Home oder im Training-Tab.</p>;
  const weeks = cardioWeeks(sessions, Date.now());
  return (
    <>
    <section className="card">
      <h2>Cardio pro Woche</h2>
      <p className="muted small">Letzte 8 Wochen</p>
      {weeks.every((w) => w.count === 0)
        ? <p className="muted small">In den letzten 8 Wochen kein Cardio.</p>
        : <BarChart tone="cardio" unit="Cardio pro Woche" fmt={fmtInt} bars={weeks.map((w) => ({ label: fmtShortDate(dayTs(w.start)), value: w.count }))} />}
    </section>
    <ul className="list">
      {sessions.map((s) => (
        <li key={s.id} className="cardio-row">
          <span>{fmtDate(s.startedAt, true)}</span>
          <span className="muted">{cardioSummary(s)}</span>
        </li>
      ))}
    </ul>
    </>
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
