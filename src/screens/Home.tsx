import { useLiveQuery } from 'dexie-react-hooks';
import { db, getMeta } from '../db';
import { streak } from '../streak';
import { fmtDate } from '../util';
import { WeighPrompt } from '../components/Weight';
import { Habits } from '../components/Habits';
import type { HistoryTab } from './History';

export function Home({ goTraining, goBackup, goHistory }: {
  goTraining: () => void;
  goBackup: () => void;
  goHistory: (tab: HistoryTab) => void;
}) {
  const templates = useLiveQuery(() => db.templates.orderBy('order').toArray(), []);
  const sessions = useLiveQuery(() => db.sessions.toArray(), []);
  const lastBackup = useLiveQuery(() => getMeta<number | null>('lastBackup', null), []);

  if (!templates || !sessions) return <div className="screen" />;

  const finished = sessions.filter((s) => s.finishedAt);
  const todays = templates.filter((t) => t.weekdays.includes(new Date().getDay()));
  const backupDue = finished.length > 0 && (!lastBackup || Date.now() - lastBackup > 7 * 864e5);
  const flames = streak(finished, templates.length, Date.now());
  const week = finished.filter((s) => Date.now() - s.startedAt < 7 * 864e5).length;

  return (
    <div className="screen">
      <section className="home-head">
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
        <p className="muted small">{fmtDate(Date.now(), true)}</p>
        <h1>{todays.length ? todays.map((t) => t.name).join(' / ') : 'Kein Trainingstag'}</h1>
        <p className="muted small">{week} Training{week === 1 ? '' : 's'} in den letzten 7 Tagen</p>
        <button className="home-hit" onClick={goTraining} aria-label="Zum Training" />
      </section>

      <WeighPrompt />

      {backupDue && (
        <button className="banner" onClick={goBackup}>
          💾 Letztes Backup {lastBackup ? `am ${fmtDate(lastBackup)}` : 'noch nie'} – jetzt sichern
        </button>
      )}

      <Habits templateCount={templates.length} goHistory={goHistory} />
    </div>
  );
}
