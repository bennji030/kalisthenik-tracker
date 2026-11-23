import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { dotGrid, lastDayKeys, sessionDayKeys, weekDayCount, weekSessionCount } from '../habits';
import { WeightCard } from './Weight';
import { cardioOnly, strengthOnly } from '../cardio';
import type { HabitKind } from '../screens/HabitMonths';

function HabitCard({ title, dots, count, target, tab, onOpen }: {
  title: string;
  dots: string[]; // CSS-Klasse je Punkt
  count: number;
  target: number;
  tab: HabitKind;
  onOpen: (tab: HabitKind) => void;
}) {
  const fill = target > 0 ? Math.min(count / target, 1) : 0;
  return (
    <section className="habit">
      <div className="habit-title">{title}</div>
      <div className="muted small">Letzte 30 Tage</div>
      <div className="habit-dots" aria-hidden="true">
        {dots.map((c, i) => <span key={i} className={c} />)}
      </div>
      <div className="habit-bar" aria-hidden="true"><span style={{ width: `${fill * 100}%` }} /></div>
      <div className="habit-count" aria-hidden="true">
        <span className="habit-num">{count}/{target}</span> <span className="muted small">diese Woche</span>
      </div>
      <button
        className="habit-hit"
        onClick={() => onOpen(tab)}
        aria-label={`${title}, ${count} von ${target} diese Woche, Monatsübersicht öffnen`}
      />
    </section>
  );
}

export function Habits({ templateCount, goHabit, goWeight }: { templateCount: number; goHabit: (kind: HabitKind) => void; goWeight: () => void }) {
  const weights = useLiveQuery(() => db.weights.toArray(), []);
  const sessions = useLiveQuery(() => db.sessions.toArray(), []);
  if (!weights || !sessions) return null;
  const now = Date.now();
  const weighed = new Set(weights.map((w) => w.date));
  // Cardio zählt nicht fürs Wochenziel; reine Cardio-Tage bekommen eigene Punkte.
  const strength = strengthOnly(sessions);
  const trained = sessionDayKeys(strength);
  const cardio = sessionDayKeys(cardioOnly(sessions));
  const trainDots = lastDayKeys(now).map((k) => (trained.has(k) ? 'dot dot-on' : cardio.has(k) ? 'dot dot-cardio' : 'dot'));
  return (
    <section>
      <h2 className="habits-head">Gewohnheiten</h2>
      <div className="cards cards-habits">
        <HabitCard
          title="Weigh-In" tab="weights" onOpen={goHabit}
          dots={dotGrid(weighed, now).map((on) => (on ? 'dot dot-on' : 'dot'))} count={weekDayCount(weighed, now)} target={7}
        />
        <HabitCard
          title="Trainings" tab="sessions" onOpen={goHabit}
          dots={trainDots} count={weekSessionCount(strength, now)} target={templateCount}
        />
        <WeightCard entries={weights} onOpen={goWeight} />
      </div>
    </section>
  );
}
