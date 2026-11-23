import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getMeta, type Template } from '../db';
import { streak } from '../streak';
import { planTemplate, startSession, type Plan } from '../sessions';
import { fmtDate, fmtKg, WEEKDAYS } from '../util';

export function Home({ onOpen, goBackup }: { onOpen: (sessionId: string) => void; goBackup: () => void }) {
  const templates = useLiveQuery(() => db.templates.orderBy('order').toArray(), []);
  const sessions = useLiveQuery(() => db.sessions.toArray(), []);
  const lastBackup = useLiveQuery(() => getMeta<number | null>('lastBackup', null), []);
  const [selected, setSelected] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan[] | null>(null);
  const [busy, setBusy] = useState(false);

  const today = new Date().getDay();
  const active = sessions?.find((s) => s.finishedAt == null);
  const finished = (sessions ?? []).filter((s) => s.finishedAt);
  const todays = templates?.filter((t) => t.weekdays.includes(today)) ?? [];
  const current: Template | undefined =
    templates?.find((t) => t.id === selected) ?? todays[0] ?? undefined;

  useEffect(() => {
    if (!current) { setPlan(null); return; }
    let alive = true;
    void planTemplate(current).then((p) => alive && setPlan(p));
    return () => { alive = false; };
  }, [current?.id, current, sessions?.length]);

  if (!templates || !sessions) return <div className="screen" />;

  const lastOf = (t: Template) =>
    finished.filter((s) => s.templateId === t.id).sort((a, b) => b.startedAt - a.startedAt)[0];

  const backupDue = finished.length > 0 && (!lastBackup || Date.now() - lastBackup > 7 * 864e5);
  const flames = streak(finished, templates.length, Date.now());
  const week = finished.filter((s) => Date.now() - s.startedAt < 7 * 864e5).length;

  const start = async () => {
    if (!current || busy) return;
    setBusy(true);
    const id = await startSession(current);
    setBusy(false);
    onOpen(id);
  };

  return (
    <div className="screen">
      <header className="home-head">
        <div className={`streak ${flames > 0 ? '' : 'streak-zero'}`} aria-label={`${flames} Training${flames === 1 ? '' : 's'} in Folge`}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
            <path d="M12 2c1 3.5 4 5.5 4 9.500a4 4 0 0 1-1.500 3.100c.3-1.600-.2-3-1.500-4.100-.4 2-1.500 3-2.5 3.900C9 15.5 8 16.500 8 18a4 4 0 0 0 8 0h2a6 6 0 0 1-12 0c0-2.500 1.500-4 2.800-5.300C9.700 11.300 10.500 9 9 6c1.500.3 2.600-.5 3-4z" />
          </svg>
          <span>{flames}</span>
        </div>
        <p className="muted small">{fmtDate(Date.now(), true)}</p>
        <h1>{todays.length ? 'Heute' : 'Kein Trainingstag'}</h1>
        <p className="muted small">{week} Training{week === 1 ? '' : 's'} in den letzten 7 Tagen</p>
      </header>

      {backupDue && (
        <button className="banner" onClick={goBackup}>
          💾 Letztes Backup {lastBackup ? `am ${fmtDate(lastBackup)}` : 'noch nie'} – jetzt sichern
        </button>
      )}

      {active && (
        <section className="card card-accent">
          <h2>{active.templateName} läuft</h2>
          <p className="muted small">Angefangen um {new Date(active.startedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</p>
          <button className="btn btn-primary btn-big" onClick={() => onOpen(active.id)}>Weitermachen</button>
        </section>
      )}

      <div className="chips">
        {templates.map((t) => (
          <button
            key={t.id}
            className={`chip ${current?.id === t.id ? 'chip-on' : ''}`}
            onClick={() => setSelected(t.id)}
          >
            {t.name}
            {t.weekdays.length > 0 && <span className="chip-sub">{t.weekdays.map((d) => WEEKDAYS[d]).join('/')}</span>}
          </button>
        ))}
      </div>

      {current && (
        <section className="card">
          <div className="row">
            <h2>{current.name}</h2>
            {lastOf(current) && <span className="muted small push-right">zuletzt {fmtDate(lastOf(current)!.startedAt)}</span>}
          </div>
          <ul className="preview">
            {(plan ?? []).map(({ slot, exercise, suggestion: s, lastSummary }) => (
              <li key={slot.id}>
                <div className="preview-name">{exercise.name}</div>
                <div className="preview-target">{previewText(s.reps, s.weight, exercise.type, s.kind)}</div>
                {s.kind !== 'free' && s.kind !== 'first' && <div className="muted small">{s.label}</div>}
                {lastSummary && <div className="muted small">vorher: {lastSummary}</div>}
              </li>
            ))}
          </ul>
          {!active && (
            <button className="btn btn-primary btn-big" onClick={start} disabled={busy}>
              Training starten
            </button>
          )}
        </section>
      )}
    </div>
  );
}

function previewText(reps: (number | null)[], weight: number | null, type: string, kind: string): string {
  if (type === 'hold' || kind === 'free') return `${reps.length} Sätze · frei`;
  const r = reps.map((x) => x ?? 0);
  const repStr = r.every((x) => x === r[0]) ? `${r.length}×${r[0]}` : r.join(', ');
  return type === 'weighted' ? `${repStr} @ ${fmtKg(weight)} kg` : `${repStr} Wdh.`;
}
