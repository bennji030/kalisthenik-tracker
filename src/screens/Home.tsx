import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getMeta, type Session, type Template } from '../db';
import { startSession } from '../sessions';
import { estimateMinutes, nextTraining } from '../today';
import { dayKey } from '../weight';
import { parseProfile } from '../profile';
import { streak } from '../streak';
import { fmtDate } from '../util';
import { WeighPrompt } from '../components/Weight';
import { Habits } from '../components/Habits';
import type { HabitKind } from './HabitMonths';

function TodayCard({ templates, sessions, openWorkout }: {
  templates: Template[];
  sessions: Session[];
  openWorkout: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const active = sessions.find((s) => s.finishedAt == null);
  if (active) {
    return (
      <section className="card card-accent">
        <h2>{active.templateName} läuft</h2>
        <button className="btn btn-primary btn-big" onClick={() => openWorkout(active.id)}>Weitermachen</button>
      </section>
    );
  }

  const today = dayKey(Date.now());
  const doneToday = sessions
    .filter((s) => s.finishedAt != null && dayKey(s.startedAt) === today)
    .sort((a, b) => a.startedAt - b.startedAt);
  if (doneToday.length) {
    return (
      <section className="card">
        <h2 className="habit-ok">Erledigt ✓</h2>
        {doneToday.map((s) => (
          <p key={s.id} className="muted small">{s.templateName} · {Math.round(((s.finishedAt ?? s.startedAt) - s.startedAt) / 60000)} min</p>
        ))}
      </section>
    );
  }

  const todays = templates.filter((t) => t.weekdays.includes(new Date().getDay()));
  if (todays.length) {
    const start = async (t: Template) => {
      if (busy) return;
      setBusy(true);
      const id = await startSession(t);
      setBusy(false);
      openWorkout(id);
    };
    return (
      <section className="card">
        {todays.map((t) => {
          const m = estimateMinutes(t.slots);
          return (
            <div key={t.id}>
              <h2>{t.name}</h2>
              <p className="muted small">{t.slots.length === 1 ? '1 Übung' : `${t.slots.length} Übungen`}{m > 0 && ` · ca. ${m} min`}</p>
              <button className="btn btn-primary btn-big" disabled={busy} onClick={() => start(t)}>Training starten</button>
            </div>
          );
        })}
      </section>
    );
  }

  const next = nextTraining(templates, Date.now());
  return (
    <section className="card">
      <p className="muted">Ruhetag: Heute ist kein Training geplant.</p>
      {next && <p className="muted small">{next.label}: {next.names.join(' / ')}</p>}
    </section>
  );
}

export function Home({ goTraining, goSettings, goHabit, openWorkout, goWeight }: {
  goTraining: () => void;
  goSettings: () => void;
  goHabit: (kind: HabitKind) => void;
  openWorkout: (id: string) => void;
  goWeight: () => void;
}) {
  const templates = useLiveQuery(() => db.templates.orderBy('order').toArray(), []);
  const sessions = useLiveQuery(() => db.sessions.toArray(), []);
  const profile = useLiveQuery(async () => parseProfile(await getMeta<unknown>('profile', undefined), Date.now()), []);
  const lastBackup = useLiveQuery(() => getMeta<number | null>('lastBackup', null), []);

  if (!templates || !sessions) return <div className="screen" />;

  const finished = sessions.filter((s) => s.finishedAt);
  const backupDue = finished.length > 0 && (!lastBackup || Date.now() - lastBackup > 7 * 864e5);
  const flames = streak(finished, templates.length, Date.now());
  const week = finished.filter((s) => Date.now() - s.startedAt < 7 * 864e5).length;

  return (
    <div className="screen">
      <section className="home-head">
        <div className="home-top">
          <p className="home-greet">{profile?.name ? `Hallo ${profile.name}` : ''}</p>
          <div
            className={flames > 0 ? 'streak' : 'streak streak-zero'}
            role="img"
            aria-label={`${flames} Training${flames === 1 ? '' : 's'} in Folge`}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
              <path d="M19.48 12.35c-1.57-4.08-7.16-4.3-5.81-10.23.1-.44-.37-.78-.75-.55C9.29 3.71 6.68 8 8.87 13.62c.18.46-.36.89-.75.59-1.81-1.37-2-3.34-1.84-4.75.06-.52-.62-.77-.91-.34C4.69 10.16 4 11.84 4 14.37c.38 5.6 5.11 7.32 6.81 7.54 2.43.31 5.06-.14 6.95-1.87 2.08-1.93 2.84-5.01 1.72-7.69z" />
            </svg>
            <span>{flames}</span>
          </div>
          <button className="gear" onClick={goSettings} aria-label="Einstellungen">
            <svg className="tab-icon" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
              <circle cx="12" cy="12" r="6.5" />
            </svg>
          </button>
        </div>
        <p className="muted small">{fmtDate(Date.now(), true)}</p>
        <p className="muted small">{week} Training{week === 1 ? '' : 's'} in den letzten 7 Tagen</p>
        <button className="home-hit" onClick={goTraining} aria-label="Zum Training" />
      </section>

      <TodayCard templates={templates} sessions={sessions} openWorkout={openWorkout} />

      <WeighPrompt />

      {backupDue && (
        <button className="banner" onClick={goSettings}>
          💾 Letztes Backup {lastBackup ? `am ${fmtDate(lastBackup)}` : 'noch nie'} – jetzt sichern
        </button>
      )}

      <Habits templateCount={templates.length} goHabit={goHabit} goWeight={goWeight} />
    </div>
  );
}
