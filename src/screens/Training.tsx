import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Template } from '../db';
import { planTemplate, startSession, type Plan } from '../sessions';
import { fmtDate, fmtAddedKg, WEEKDAYS } from '../util';

export function Training({ onOpen }: { onOpen: (sessionId: string) => void }) {
  const templates = useLiveQuery(() => db.templates.orderBy('order').toArray(), []);
  const sessions = useLiveQuery(() => db.sessions.toArray(), []);
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

  const start = async () => {
    if (!current || busy) return;
    setBusy(true);
    const id = await startSession(current);
    setBusy(false);
    onOpen(id);
  };

  return (
    <div className="screen">
      <h1>{todays.length ? 'Heute' : 'Kein Trainingstag'}</h1>

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
  return type === 'weighted' && weight ? `${repStr} ${fmtAddedKg(weight)}` : `${repStr} Wdh.`;
}
