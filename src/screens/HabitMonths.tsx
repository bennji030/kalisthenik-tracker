import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { monthGrid } from '../calendar';
import { DayHeader } from '../components/MonthGrid';
import { sessionDayKeys } from '../habits';
import { dayMonthCount, earliestKey, monthList, sessionMonthCount, sessionSummary, weighSummary } from '../monthTiles';
import { fmtMonth } from '../util';
import { dayKey } from '../weight';
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
