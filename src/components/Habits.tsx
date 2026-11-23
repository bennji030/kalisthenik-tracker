import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { dotGrid, sessionDayKeys, weekDayCount, weekSessionCount } from '../habits';
import type { HistoryTab } from '../screens/History';

function HabitCard({ title, dots, count, target, tab, onOpen }: {
  title: string;
  dots: boolean[];
  count: number;
  target: number;
  tab: HistoryTab;
  onOpen: (tab: HistoryTab) => void;
}) {
  const fill = target > 0 ? Math.min(count / target, 1) : 0;
  return (
    <section className="habit">
      <div className="habit-title">{title}</div>
      <div className="muted small">Letzte 30 Tage</div>
      <div className="habit-dots" aria-hidden="true">
        {dots.map((on, i) => <span key={i} className={on ? 'dot dot-on' : 'dot'} />)}
      </div>
      <div className="habit-bar" aria-hidden="true"><span style={{ width: `${fill * 100}%` }} /></div>
      <div className="habit-count" aria-hidden="true">
        <span className="habit-num">{count}/{target}</span> <span className="muted small">diese Woche</span>
      </div>
      <button
        className="habit-hit"
        onClick={() => onOpen(tab)}
        aria-label={`${title}, ${count} von ${target} diese Woche, ${tab === 'weights' ? 'Gewicht' : 'Trainings'} öffnen`}
      />
    </section>
  );
}

export function Habits({ templateCount, goHistory }: { templateCount: number; goHistory: (tab: HistoryTab) => void }) {
  const weights = useLiveQuery(() => db.weights.toArray(), []);
  const sessions = useLiveQuery(() => db.sessions.toArray(), []);
  if (!weights || !sessions) return null;
  const now = Date.now();
  const weighed = new Set(weights.map((w) => w.date));
  const trained = sessionDayKeys(sessions);
  return (
    <section>
      <h2 className="habits-head">Gewohnheiten</h2>
      <div className="cards cards-habits">
        <HabitCard
          title="Weigh-In" tab="weights" onOpen={goHistory}
          dots={dotGrid(weighed, now)} count={weekDayCount(weighed, now)} target={7}
        />
        <HabitCard
          title="Trainings" tab="sessions" onOpen={goHistory}
          dots={dotGrid(trained, now)} count={weekSessionCount(sessions, now)} target={templateCount}
        />
      </div>
    </section>
  );
}
