import { useLiveQuery } from 'dexie-react-hooks';
import { db, getMeta, type DayValues } from '../db';
import { dotGrid, lastDayKeys, sessionDayKeys, weekDayCount, weekSessionCount } from '../habits';
import { WeightCard } from './Weight';
import { cardioOnly, strengthOnly } from '../cardio';
import { goalProgress, parseGoals, stepsWeek, type Goals } from '../dayValues';
import { fmtBalance, kcalBalance } from '../healthKit';
import { fmtInt } from '../util';
import { dayKey } from '../weight';
import { isConfigured, parseHealthConfig, shortcutUrl } from '../health';
import { forceNextSync } from '../healthSync';
import type { HabitKind } from '../screens/HabitMonths';
import type { DayView } from '../screens/DayValues';

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

/** Liegt über dem habit-hit (z-index), ein Tipp öffnet nur die Einstellungen. */
function SetupButton({ goSettings }: { goSettings: () => void }) {
  return <button className="btn btn-small habit-setup" onClick={goSettings}>Einrichten</button>;
}

/** Startet den Kurzbefehl; nach der Rückkehr in die App wird sofort abgeholt. */
function RefreshButton({ shortcut }: { shortcut: string }) {
  const run = () => {
    forceNextSync();
    window.location.href = shortcutUrl(shortcut);
  };
  return <button className="btn btn-small habit-setup" onClick={run}>Jetzt aktualisieren</button>;
}

function StepsCard({ days, goals, now, shortcut, onOpen, goSettings }: {
  days: DayValues[];
  goals: Goals;
  now: number;
  shortcut: string | null; // gesetzt, wenn Apple Health eingerichtet ist
  onOpen: () => void;
  goSettings: () => void;
}) {
  const week = stepsWeek(days, now);
  const steps = week[week.length - 1].steps;
  return (
    <section className="habit">
      <div className="habit-title">Schritte heute</div>
      {steps != null ? (
        <div className="habit-count">
          <span className="habit-num">{fmtInt(steps)}</span> <span className="muted small">/ {fmtInt(goals.steps)}</span>
        </div>
      ) : (
        <p className="muted small">Noch keine Schritte</p>
      )}
      {shortcut != null ? <RefreshButton shortcut={shortcut} /> : steps == null && <SetupButton goSettings={goSettings} />}
      <div className="step-bars" aria-hidden="true">
        {week.map((d) => {
          const p = goalProgress(d.steps, goals.steps);
          const cls = d.steps == null ? 'step-bar step-bar-none' : p >= 1 ? 'step-bar step-bar-ok' : 'step-bar';
          return <span key={d.date} className={cls} style={d.steps == null ? undefined : { height: `${Math.max(p * 100, 4)}%` }} />;
        })}
      </div>
      <div className="muted small">Letzte 7 Tage</div>
      <button
        className="habit-hit"
        onClick={onOpen}
        aria-label={steps != null ? `Schritte heute: ${fmtInt(steps)} von ${fmtInt(goals.steps)}, Verlauf öffnen` : 'Schritte heute: noch keine, Verlauf öffnen'}
      />
    </section>
  );
}

function KcalCard({ today, goals, onOpen, goSettings }: {
  today: DayValues | undefined;
  goals: Goals;
  onOpen: () => void;
  goSettings: () => void;
}) {
  const kcal = today?.kcal ?? null;
  const protein = today?.proteinG ?? null;
  const empty = kcal == null && protein == null;
  const R = 22, C = 2 * Math.PI * R;
  const fill = goalProgress(kcal, goals.kcal);
  const show = (n: number | null) => (n == null ? '–' : fmtInt(n));
  const bal = kcalBalance(today);
  const burned = bal && `verbraucht ${fmtInt(bal.burned)} kcal`;
  const balance = bal?.balance != null ? `Bilanz ${fmtBalance(bal.balance)}` : null;
  const said = burned ? `, ${burned}${balance ? `, ${balance}` : ''}` : '';
  return (
    <section className="habit">
      <div className="habit-title">Kalorien heute</div>
      {empty ? (
        <>
          <p className="muted small">Noch keine Kalorien</p>
          <SetupButton goSettings={goSettings} />
        </>
      ) : (
        <>
          <div className="kcal-row">
            <svg className="kcal-ring" viewBox="0 0 56 56" aria-hidden="true">
              <circle cx="28" cy="28" r={R} className="kcal-track" />
              {fill > 0 && <circle cx="28" cy="28" r={R} className="kcal-fill" strokeDasharray={`${fill * C} ${C}`} transform="rotate(-90 28 28)" />}
            </svg>
            <div className="kcal-text">
              <span className="habit-num">{show(kcal)}</span> <span className="muted small">/ {fmtInt(goals.kcal)} kcal</span>
            </div>
          </div>
          <div className="small">Protein <b className="habit-val">{show(protein)}</b> <span className="muted">/ {fmtInt(goals.proteinG)} g</span></div>
        </>
      )}
      {burned && <div className="muted small">{burned}{balance && <> · <span className="nowrap">{balance}</span></>}</div>}
      <button
        className="habit-hit"
        onClick={onOpen}
        aria-label={empty
          ? `Kalorien heute: noch keine${said}, Verlauf öffnen`
          : `Kalorien heute: ${show(kcal)} von ${fmtInt(goals.kcal)} kcal, Protein ${show(protein)} von ${fmtInt(goals.proteinG)} g${said}, Verlauf öffnen`}
      />
    </section>
  );
}

export function Habits({ templateCount, goHabit, goWeight, goDay, goSettings }: {
  templateCount: number;
  goHabit: (kind: HabitKind) => void;
  goWeight: () => void;
  goDay: (view: DayView) => void;
  goSettings: () => void;
}) {
  const weights = useLiveQuery(() => db.weights.toArray(), []);
  const sessions = useLiveQuery(() => db.sessions.toArray(), []);
  const days = useLiveQuery(() => db.days.toArray(), []);
  const goals = useLiveQuery(async () => parseGoals(await getMeta<unknown>('goals', undefined)), []);
  const health = useLiveQuery(async () => parseHealthConfig(await getMeta<unknown>('health', undefined)), []);
  if (!weights || !sessions || !days || !goals || !health) return null;
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
        <StepsCard days={days} goals={goals} now={now} shortcut={isConfigured(health) ? health.shortcut : null} onOpen={() => goDay('steps')} goSettings={goSettings} />
        <KcalCard today={days.find((d) => d.date === dayKey(now))} goals={goals} onOpen={() => goDay('kcal')} goSettings={goSettings} />
        <WeightCard entries={weights} onOpen={goWeight} />
      </div>
    </section>
  );
}
