import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { monthGrid } from '../calendar';
import { DayHeader } from '../components/MonthGrid';
import { LineChart } from '../components/LineChart';
import { WeightStats } from '../components/Weight';
import { sessionDayKeys } from '../habits';
import { dayMonthCount, earliestKey, monthList, sessionMonthCount, sessionSummary, weighSummary } from '../monthTiles';
import { fmtMonth, fmtShortDate } from '../util';
import { dayKey, dayTs } from '../weight';
import { weightRangePoints } from '../weightRange';
import type { WeightRange } from '../weightRange';
import type { WeightEntry } from '../db';
import type { HistoryTab } from './History';

export type HabitKind = 'sessions' | 'weights';

export function HabitMonths({ kind, onBack, goHistory }: {
  kind: HabitKind;
  onBack: () => void;
  goHistory: (tab: HistoryTab) => void;
}) {
  const weights = useLiveQuery(() => db.weights.toArray(), []);
  const sessions = useLiveQuery(() => db.sessions.toArray(), []);
  if (!weights || !sessions) return null;
  const now = Date.now();
  const todayKey = dayKey(now);
  const days = kind === 'sessions' ? sessionDayKeys(sessions) : new Set(weights.map((w) => w.date));
  return (
    <div className="screen">
      <header className="wo-head">
        <h1>{kind === 'sessions' ? 'Trainings' : 'Weigh-In'}</h1>
        <button className="btn btn-ghost" onClick={onBack}>Zurück</button>
      </header>
      {kind === 'weights' && weights.length > 0 && <WeightCurve weights={weights} now={now} />}
      <button className="btn btn-ghost link-btn" onClick={() => goHistory(kind)}>Zum Verlauf</button>
      <div className="cards">
        {monthList(earliestKey(days), now).map(({ year, month }) => (
          <section className="card month-tiles" key={`${year}-${month}`}>
            <h2>{fmtMonth(year, month)}</h2>
            <DayHeader />
            {monthGrid(year, month).map((week, i) => (
              <div className="cal-row" key={i}>
                {week.map((k, j) => k
                  ? <span key={k} className={`tile${days.has(k) ? ' tile-on' : ''}${k > todayKey ? ' tile-future' : ''}`} />
                  : <span key={`e${j}`} />)}
              </div>
            ))}
            <p className="muted small">
              {kind === 'sessions' ? sessionSummary(sessionMonthCount(sessions, year, month)) : weighSummary(dayMonthCount(days, year, month))}
            </p>
          </section>
        ))}
      </div>
    </div>
  );
}

const RANGES: { value: WeightRange; label: string }[] = [
  { value: 30, label: '30 Tage' },
  { value: 90, label: '90 Tage' },
  { value: 'all', label: 'Alles' },
];

function WeightCurve({ weights, now }: { weights: WeightEntry[]; now: number }) {
  const [range, setRange] = useState<WeightRange>(30);
  const pts = weightRangePoints(weights, range, now);
  const label = (date: string) => fmtShortDate(dayTs(date));
  return (
    <section className="card readable">
      <WeightStats entries={weights} />
      <div className="seg seg-tall">
        {RANGES.map((r) => (
          <button key={r.label} className={range === r.value ? 'on' : ''} onClick={() => setRange(r.value)}>{r.label}</button>
        ))}
      </div>
      <LineChart
        unit="kg"
        points={pts.map((r) => ({ x: dayTs(r.date), y: r.kg, label: label(r.date) }))}
        line={pts.map((r) => ({ x: dayTs(r.date), y: r.avg, label: label(r.date) }))}
        legend={{ points: 'Tageswert', line: '7-Tage-Schnitt' }}
        emptyText="Ab zwei Einträgen in diesem Zeitraum gibt es hier eine Kurve."
      />
    </section>
  );
}
