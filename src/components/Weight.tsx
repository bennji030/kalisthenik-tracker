import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, saveWeight, type WeightEntry } from '../db';
import { dayKey, fmtDelta, fmtWeight, isValidKg, roundKg, weightSummary } from '../weight';
import { NumInput } from './NumInput';

/** 7-Tage-Schnitt groß, darunter die Änderung zur Vorwoche (grün, wenn es runtergeht). */
export function WeightStats({ entries }: { entries: WeightEntry[] }) {
  const s = weightSummary(entries);
  if (!s) return null;
  return (
    <div className="weight-stats">
      <div>
        <div className="weight-avg">{fmtWeight(s.avg)} kg</div>
        <div className="muted small">7-Tage-Schnitt</div>
      </div>
      {s.delta != null && (
        <div className="push-right weight-delta-box">
          <div className={roundKg(s.delta) < 0 ? 'weight-delta down' : 'weight-delta'}>{fmtDelta(s.delta)}</div>
          <div className="muted small">zur Vorwoche</div>
        </div>
      )}
    </div>
  );
}

/** Schnelleingabe auf dem Startbildschirm. */
export function WeightCard() {
  const weights = useLiveQuery(() => db.weights.toArray(), []);
  const [kg, setKg] = useState<number | null>(null);
  const [date, setDate] = useState(() => dayKey(Date.now()));
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(null), 2600);
    return () => clearTimeout(t);
  }, [saved]);

  const today = dayKey(Date.now());
  const todays = weights?.find((w) => w.date === today);
  const valid = isValidKg(kg) && date !== '';

  const save = async () => {
    if (!valid || kg == null) return;
    await saveWeight(date, kg);
    setSaved(`${fmtWeight(kg)} kg gespeichert`);
    setKg(null);
    setDate(dayKey(Date.now()));
  };

  return (
    <section className="card">
      <div className="row">
        <h2>Gewicht</h2>
        {todays && <span className="muted small push-right">Heute: {fmtWeight(todays.kg)} kg</span>}
      </div>
      <WeightStats entries={weights ?? []} />
      <div className="weight-form">
        <NumInput value={kg} onChange={setKg} decimal placeholder="kg" ariaLabel="Gewicht in kg" />
        <input type="date" className="date" aria-label="Datum" value={date} onChange={(e) => setDate(e.target.value)} />
        <button className="btn btn-primary" onClick={save} disabled={!valid}>Speichern</button>
      </div>
      {saved && <p className="small ok-text" role="status">{saved}</p>}
    </section>
  );
}
