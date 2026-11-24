import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getMeta, saveWeight, setMeta, type WeightEntry } from '../db';
import { dayKey, fmtDelta, fmtWeight, isValidKg, roundKg, weighPromptDue, weightSummary } from '../weight';
import { weightTrend } from '../today';
import { LineChart } from './LineChart';
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

/** Tägliche Gewichtsabfrage auf Home, bis heute gewogen oder übersprungen wurde. */
export function WeighPrompt({ accent }: { accent: boolean }) {
  const weights = useLiveQuery(() => db.weights.toArray(), []);
  const skip = useLiveQuery(async () => ({ day: await getMeta<string | null>('weighSkip', null) }), []);
  const [kg, setKg] = useState<number | null>(null);

  if (!weights || !skip || !weighPromptDue(weights, skip.day, Date.now())) return null;

  return (
    <section className={accent ? 'card card-accent' : 'card'}>
      <h2>Heute schon gewogen?</h2>
      <div className="weight-form">
        <NumInput value={kg} onChange={setKg} decimal placeholder="kg" ariaLabel="Gewicht in kg" />
        <button
          className="btn btn-primary"
          disabled={!isValidKg(kg)}
          onClick={() => kg != null && saveWeight(dayKey(Date.now()), kg)}
        >
          Speichern
        </button>
      </div>
      <button className="btn btn-ghost" onClick={() => setMeta('weighSkip', dayKey(Date.now()))}>Heute nicht</button>
    </section>
  );
}

/** Home-Karte: 7-Tage-Schnitt und Kurve der letzten 30 Tage; öffnet Verlauf → Gewicht. */
export function WeightCard({ entries, onOpen }: { entries: WeightEntry[]; onOpen: () => void }) {
  return (
    <section className="habit habit-weight">
      <div className="habit-title">Gewicht</div>
      {entries.length ? (
        <>
          <WeightStats entries={entries} />
          <LineChart points={weightTrend(entries, Date.now())} unit="kg" emptyText="Ab zwei Einträgen gibt es hier eine Kurve." />
        </>
      ) : (
        <p className="muted small">Noch kein Gewicht, trag morgen früh dein erstes ein.</p>
      )}
      <button className="habit-hit" onClick={onOpen} aria-label="Gewicht, Verlauf öffnen" />
    </section>
  );
}
