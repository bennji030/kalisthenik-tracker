import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, saveDay, type DayValues as DayRowData } from '../db';
import { LineChart } from '../components/LineChart';
import { NumInput } from '../components/NumInput';
import { dayTrend, isValidKcal, isValidProtein, isValidSteps, nextManual, type DayField, type DayPatch } from '../dayValues';
import { isDayKey } from '../profile';
import { fmtDate, fmtInt } from '../util';
import { dayKey, dayTs } from '../weight';

export type DayView = 'steps' | 'kcal';

type Values = Record<DayField, number | null>;

const EMPTY: Values = { steps: null, kcal: null, proteinG: null };

const valuesOf = (d: DayRowData | undefined): Values => ({ steps: d?.steps ?? null, kcal: d?.kcal ?? null, proteinG: d?.proteinG ?? null });

/** Mindestens ein Feld gefüllt und jedes gefüllte Feld gültig. */
function valuesOk(v: Values): boolean {
  const filled = [v.steps, v.kcal, v.proteinG].some((n) => n != null);
  return filled && (v.steps == null || isValidSteps(v.steps)) && (v.kcal == null || isValidKcal(v.kcal)) && (v.proteinG == null || isValidProtein(v.proteinG));
}

function ValueFields({ v, set }: { v: Values; set: (v: Values) => void }) {
  return (
    <div className="day-fields">
      <label className="field">Schritte
        <NumInput value={v.steps} onChange={(n) => set({ ...v, steps: n })} ariaLabel="Schritte" />
      </label>
      <label className="field">kcal
        <NumInput value={v.kcal} onChange={(n) => set({ ...v, kcal: n })} ariaLabel="kcal" />
      </label>
      <label className="field">Protein (g)
        <NumInput value={v.proteinG} onChange={(n) => set({ ...v, proteinG: n })} ariaLabel="Protein in g" />
      </label>
    </div>
  );
}

export function DayValues({ view, onBack, toast }: { view: DayView; onBack: () => void; toast: (m: string) => void }) {
  const days = useLiveQuery(() => db.days.toArray(), []);
  if (!days) return null;
  return (
    <div className="screen">
      <header className="wo-head">
        <h1>Schritte &amp; Kalorien</h1>
        <button className="btn btn-ghost" onClick={onBack}>Zurück</button>
      </header>
      <div className="cards">
        <EntryCard days={days} toast={toast} />
        <CurveCard days={days} initial={view === 'steps' ? 'steps' : 'kcal'} />
      </div>
      {days.length === 0 ? (
        <p className="muted">Noch keine Tageswerte eingetragen.</p>
      ) : (
        <ul className="list">
          {[...days].sort((a, b) => b.date.localeCompare(a.date)).map((d) => <DayRow key={d.date} d={d} />)}
        </ul>
      )}
    </div>
  );
}

function EntryCard({ days, toast }: { days: DayRowData[]; toast: (m: string) => void }) {
  const today = dayKey(Date.now());
  const [date, setDate] = useState(today);
  const [v, setV] = useState<Values>(() => valuesOf(days.find((d) => d.date === today)));
  const dateOk = isDayKey(date) && date <= today;

  const pick = (d: string) => {
    setDate(d);
    setV(valuesOf(days.find((x) => x.date === d)));
  };
  const save = async () => {
    const patch: DayPatch = {};
    if (v.steps != null) patch.steps = v.steps;
    if (v.kcal != null) patch.kcal = v.kcal;
    if (v.proteinG != null) patch.proteinG = v.proteinG;
    await saveDay(date, patch);
    setV(EMPTY);
    toast('Gespeichert');
  };

  return (
    <section className="card">
      <h2>Eintragen</h2>
      <label className="field">Datum
        <input type="date" max={today} value={date} onChange={(e) => pick(e.target.value)} />
      </label>
      <ValueFields v={v} set={setV} />
      <button className="btn btn-primary" disabled={!dateOk || !valuesOk(v)} onClick={save}>Speichern</button>
    </section>
  );
}

const SERIES: { field: DayField; label: string; unit: string }[] = [
  { field: 'steps', label: 'Schritte', unit: 'Schritte' },
  { field: 'kcal', label: 'kcal', unit: 'kcal' },
  { field: 'proteinG', label: 'Protein', unit: 'g Protein' },
];

function CurveCard({ days, initial }: { days: DayRowData[]; initial: DayField }) {
  const [field, setField] = useState<DayField>(initial);
  const unit = SERIES.find((s) => s.field === field)!.unit;
  return (
    <section className="card">
      <h2>Kurve</h2>
      <div className="seg seg-tall">
        {SERIES.map((s) => (
          <button key={s.field} className={field === s.field ? 'on' : ''} aria-pressed={field === s.field} onClick={() => setField(s.field)}>{s.label}</button>
        ))}
      </div>
      <LineChart
        unit={unit}
        points={dayTrend(days, field, Date.now())}
        emptyText="Ab zwei Einträgen in den letzten 30 Tagen gibt es hier eine Kurve."
      />
    </section>
  );
}

/** z. B. "8.432 Schritte · 2.150 kcal · 152 g Protein"; Zahl und Einheit bleiben zusammen (geschütztes Leerzeichen). */
function summary(d: DayRowData): string {
  const parts: string[] = [];
  if (d.steps != null) parts.push(`${fmtInt(d.steps)}\u00a0Schritte`);
  if (d.kcal != null) parts.push(`${fmtInt(d.kcal)}\u00a0kcal`);
  if (d.proteinG != null) parts.push(`${fmtInt(d.proteinG)}\u00a0g\u00a0Protein`);
  return parts.join(' · ');
}

function DayRow({ d }: { d: DayRowData }) {
  const [edit, setEdit] = useState(false);
  const [del, setDel] = useState(false);
  const [v, setV] = useState<Values>(EMPTY);
  const close = () => { setEdit(false); setDel(false); };

  if (!edit) {
    return (
      <li>
        <button className="day-row" onClick={() => { setV(valuesOf(d)); setEdit(true); }}>
          <span>{fmtDate(dayTs(d.date), true)}</span>
          <span className="day-sum">{summary(d)}</span>
        </button>
      </li>
    );
  }
  // Leeres Feld entfernt den Wert: die Zeile wird komplett neu geschrieben.
  const save = async () => {
    const next: DayRowData = { date: d.date, source: 'manual', updatedAt: Date.now() };
    if (v.steps != null) next.steps = v.steps;
    if (v.kcal != null) next.kcal = v.kcal;
    if (v.proteinG != null) next.proteinG = v.proteinG;
    if (d.burnedKcal != null) next.burnedKcal = d.burnedKcal;
    next.manual = nextManual(d, next);
    await db.days.put(next);
    close();
  };
  return (
    <li className="weight-edit day-edit">
      <p>{fmtDate(dayTs(d.date), true)}</p>
      <ValueFields v={v} set={setV} />
      <div className="row">
        <button className="btn btn-small btn-primary" disabled={!valuesOk(v)} onClick={save}>Speichern</button>
        <button className="btn btn-small" onClick={close}>Abbrechen</button>
      </div>
      <div className="row" data-no-swipe>
        {!del ? (
          <button className="btn btn-small btn-ghost danger" onClick={() => setDel(true)}>Löschen</button>
        ) : (
          <>
            <button className="btn btn-small btn-danger" onClick={() => db.days.delete(d.date)}>Wirklich löschen</button>
            <button className="btn btn-small" onClick={() => setDel(false)}>Abbrechen</button>
          </>
        )}
      </div>
    </li>
  );
}
