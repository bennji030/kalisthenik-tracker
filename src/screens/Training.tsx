import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Exercise, type Session, type Template } from '../db';
import { dayStatus, plannedWeekdays, weekKeys } from '../calendar';
import { defaultTemplate } from '../entryDay';
import { sessionDayKeys } from '../habits';
import { cardioOnly, cardioSummary, isCardio, isCardioSession, strengthOnly } from '../cardio';
import { planTemplate, startSession, type Plan } from '../sessions';
import { DayCell, DayHeader, MonthGrid } from '../components/MonthGrid';
import { SessionLog } from '../components/SessionLog';
import { CardioCheck } from '../components/CardioCheck';
import { fmtDate, fmtAddedKg, fmtLongDate, fmtMonth, WEEKDAYS } from '../util';
import { dayKey, dayTs } from '../weight';

export function Training({ onOpen }: { onOpen: (sessionId: string) => void }) {
  const templates = useLiveQuery(() => db.templates.orderBy('order').toArray(), []);
  const sessions = useLiveQuery(() => db.sessions.toArray(), []);
  const exercises = useLiveQuery(() => db.exercises.toArray(), []);
  const todayKey = dayKey(Date.now());
  const [selectedDay, setSelectedDay] = useState(todayKey);
  const [selected, setSelected] = useState<string | null>(null);
  const [entering, setEntering] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [view, setView] = useState({ y: 0, m: 0 });
  const [busy, setBusy] = useState(false);

  if (!templates || !sessions || !exercises) return <div className="screen" />;

  const active = sessions.find((s) => s.finishedAt == null);
  const finished = sessions.filter((s) => s.finishedAt);
  const doneDays = sessionDayKeys(strengthOnly(sessions));
  const cardioDays = sessionDayKeys(cardioOnly(sessions));
  const planned = plannedWeekdays(strengthOnly(templates));
  const cardioPlanned = plannedWeekdays(cardioOnly(templates));
  const statusOf = (k: string) => dayStatus(k, todayKey, doneDays, planned, cardioDays, cardioPlanned);
  const exMap = new Map(exercises.map((e) => [e.id, e]));

  const isToday = selectedDay === todayKey;
  const weekday = new Date(dayTs(selectedDay)).getDay();
  const dayTemplates = templates.filter((t) => t.weekdays.includes(weekday));
  const daySessions = finished
    .filter((s) => dayKey(s.startedAt) === selectedDay)
    .sort((a, b) => a.startedAt - b.startedAt);
  const showChips = isToday || (entering && !active);
  const chosen = showChips ? templates.find((t) => t.id === selected) : undefined;
  const status = statusOf(selectedDay);

  const lastOf = (t: Template) =>
    finished.filter((s) => s.templateId === t.id).sort((a, b) => b.startedAt - a.startedAt)[0];

  const start = async (t: Template) => {
    if (busy) return;
    setBusy(true);
    const id = await startSession(t, isToday ? undefined : selectedDay);
    setBusy(false);
    onOpen(id);
  };

  const pick = (k: string) => { setSelectedDay(k); setSelected(null); setEntering(false); };
  const enter = () => { setEntering(true); setSelected(defaultTemplate(templates, selectedDay)?.id ?? null); };
  const toggle = () => {
    if (!expanded) {
      const d = new Date(dayTs(selectedDay));
      setView({ y: d.getFullYear(), m: d.getMonth() });
    }
    setExpanded(!expanded);
  };
  const shift = (n: number) => {
    const d = new Date(view.y, view.m + n, 1);
    setView({ y: d.getFullYear(), m: d.getMonth() });
  };

  const planCard = (t: Template, canStart: boolean) => (
    <TemplateCard
      key={t.id}
      template={t}
      last={lastOf(t)}
      sessionCount={sessions.length}
      onStart={canStart && !active ? () => start(t) : undefined}
      busy={busy}
    />
  );

  // Cardio darf auch abgehakt werden, während ein Krafttraining läuft.
  const cardioCard = (t: Template, canLog: boolean) => (
    <section key={t.id} className="card">
      <CardioCheck
        template={t}
        day={isToday ? undefined : selectedDay}
        canLog={canLog}
        onLogged={() => { setSelected(null); setEntering(false); }}
      />
    </section>
  );
  const dayCard = (t: Template, canStart: boolean) => (isCardio(t) ? cardioCard(t, canStart) : planCard(t, canStart));

  let dayCards;
  if (chosen) {
    dayCards = dayCard(chosen, true);
  } else if (daySessions.length) {
    dayCards = daySessions.map((s) => (isCardioSession(s) ? <CardioDoneCard key={s.id} s={s} /> : <DoneCard key={s.id} s={s} exMap={exMap} />));
  } else if (status === 'open' || status === 'cardio-open') {
    dayCards = dayTemplates.map((t) => dayCard(t, isToday));
  } else if (status === 'missed') {
    dayCards = (
      <section className="card">
        <h2>{dayTemplates.map((t) => t.name).join(' / ')}</h2>
        <p className="muted small">Verpasst</p>
      </section>
    );
  } else {
    dayCards = (
      <section className="card">
        <p className="muted">
          {isToday ? 'Ruhetag: Heute ist kein Training geplant.' : 'Ruhetag: An diesem Tag ist kein Training geplant.'}
        </p>
      </section>
    );
  }

  return (
    <div className="screen">
      <div className="cal">
        <div className="cal-bar">
          {expanded && <button className="cal-btn" aria-label="Vorheriger Monat" onClick={() => shift(-1)}>‹</button>}
          <h1 className={expanded ? 'cal-title-month' : undefined}>{expanded ? fmtMonth(view.y, view.m) : fmtLongDate(dayTs(selectedDay))}</h1>
          {expanded && <button className="cal-btn" aria-label="Nächster Monat" onClick={() => shift(1)}>›</button>}
          <button
            className={`cal-btn cal-toggle${expanded ? ' open' : ''}`}
            aria-expanded={expanded}
            aria-label={expanded ? 'Monat ausblenden' : 'Monat anzeigen'}
            onClick={toggle}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>
        {expanded ? (
          <MonthGrid year={view.y} month={view.m} todayKey={todayKey} selectedKey={selectedDay} statusOf={statusOf} onSelect={pick} />
        ) : (
          <div className="cal-week">
            <DayHeader />
            <div className="cal-row">
              {weekKeys(selectedDay).map((k) => (
                <DayCell key={k} dayKey={k} status={statusOf(k)} today={k === todayKey} selected={k === selectedDay} onSelect={pick} />
              ))}
            </div>
          </div>
        )}
      </div>

      {active && (
        <section className="card card-accent">
          <h2>{active.templateName} läuft</h2>
          <p className="muted small">Angefangen um {new Date(active.startedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</p>
          <button className="btn btn-primary btn-big" onClick={() => onOpen(active.id)}>Weitermachen</button>
        </section>
      )}

      {dayCards}

      {!isToday && !active && !entering && (
        <button className="btn btn-big" onClick={enter}>Training für diesen Tag eintragen</button>
      )}

      {showChips && (
        <div className="chips">
          {templates.map((t) => (
            <button
              key={t.id}
              className={`chip ${chosen?.id === t.id ? 'chip-on' : ''}`}
              onClick={() => setSelected(t.id)}
            >
              {t.name}
              {t.weekdays.length > 0 && <span className="chip-sub">{t.weekdays.map((d) => WEEKDAYS[d]).join('/')}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DoneCard({ s, exMap }: { s: Session; exMap: Map<string, Exercise> }) {
  const mins = s.finishedAt ? Math.round((s.finishedAt - s.startedAt) / 60000) : 0;
  return (
    <section className="card">
      <h2>{s.templateName}</h2>
      <p className="muted small">{fmtDate(s.startedAt, true)} · {mins} min</p>
      <SessionLog entries={s.entries} exMap={exMap} />
    </section>
  );
}

function CardioDoneCard({ s }: { s: Session }) {
  return (
    <section className="card">
      <h2>{s.templateName}</h2>
      <p className="muted small">{fmtDate(s.startedAt, true)} · {cardioSummary(s)}</p>
    </section>
  );
}

function TemplateCard({ template, last, sessionCount, onStart, busy }: {
  template: Template;
  last: Session | undefined;
  sessionCount: number;
  onStart?: () => void;
  busy: boolean;
}) {
  const [plan, setPlan] = useState<Plan[] | null>(null);
  useEffect(() => {
    let alive = true;
    void planTemplate(template).then((p) => alive && setPlan(p));
    return () => { alive = false; };
  }, [template, sessionCount]);

  return (
    <section className="card">
      <div className="row">
        <h2>{template.name}</h2>
        {last && <span className="muted small push-right">zuletzt {fmtDate(last.startedAt)}</span>}
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
      {onStart && (
        <button className="btn btn-primary btn-big" onClick={onStart} disabled={busy}>
          Training starten
        </button>
      )}
    </section>
  );
}

function previewText(reps: (number | null)[], weight: number | null, type: string, kind: string): string {
  if (type === 'hold' || kind === 'free') return `${reps.length} Sätze · frei`;
  const r = reps.map((x) => x ?? 0);
  const repStr = r.every((x) => x === r[0]) ? `${r.length}×${r[0]}` : r.join(', ');
  return type === 'weighted' && weight ? `${repStr} ${fmtAddedKg(weight)}` : `${repStr} Wdh.`;
}
