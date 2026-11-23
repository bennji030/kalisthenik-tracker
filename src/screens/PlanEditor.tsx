import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Exercise, type ExType, type Slot, type Template } from '../db';
import { NumInput } from '../components/NumInput';
import { uid, WEEKDAYS } from '../util';
import { isCardio } from '../cardio';

const TYPE_LABEL: Record<ExType, string> = { weighted: 'Wdh. + Gewicht', reps: 'Wdh.', hold: 'Haltezeit' };

export function PlanScreen() {
  const templates = useLiveQuery(() => db.templates.orderBy('order').toArray(), []);
  const exercises = useLiveQuery(() => db.exercises.toArray(), []);
  const [editing, setEditing] = useState<Template | null>(null);
  const [showLib, setShowLib] = useState(false);
  if (!templates || !exercises) return <div className="screen" />;
  const exMap = new Map(exercises.map((e) => [e.id, e]));

  if (editing) return <TemplateEditor initial={editing} exercises={exercises} onClose={() => setEditing(null)} />;

  const addTemplate = () =>
    setEditing({ id: uid(), name: 'Neuer Tag', weekdays: [], order: templates.length, slots: [] });
  const addCardio = () =>
    setEditing({ id: uid(), name: 'Cardio', weekdays: [], order: templates.length, slots: [], kind: 'cardio' });

  return (
    <div className="screen">
      <h1>Plan</h1>
      <p className="muted small">Änderungen gelten ab dem nächsten Training. Der Verlauf bleibt erhalten.</p>
      <div className="cards">
      {templates.map((t) => (
        <section key={t.id} className="card">
          <button className="card-toggle" onClick={() => setEditing(structuredClone(t))}>
            <div>
              <h2>{t.name}</h2>
              <p className="muted small">{t.weekdays.map((d) => WEEKDAYS[d]).join(', ') || 'kein fester Tag'}</p>
            </div>
            <span className="muted">Bearbeiten ›</span>
          </button>
          {isCardio(t) ? (
            <p className="muted small">Cardio · abhaken</p>
          ) : (
            <ul className="log">
              {t.slots.map((s) => (
                <li key={s.id}>
                  <span>{exMap.get(s.exerciseId)?.name ?? '?'}</span>
                  <span className="muted">{slotText(s, exMap.get(s.exerciseId))}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
      </div>
      <div className="plan-add">
        <button className="btn" onClick={addTemplate}>+ Trainingstag</button>
        <button className="btn" onClick={addCardio}>+ Cardio-Tag</button>
      </div>

      <h1 className="mt">Übungen</h1>
      <button className="btn" onClick={() => setShowLib(!showLib)}>{showLib ? 'Übungsliste schließen' : 'Übungsliste bearbeiten'}</button>
      {showLib && <ExerciseLibrary exercises={exercises} templates={templates} />}
    </div>
  );
}

function slotText(s: Slot, ex?: Exercise): string {
  if (!ex) return '';
  if (ex.type === 'hold' || !s.progression) return `${s.sets} Sätze · frei`;
  return `${s.sets}×${s.repMin}–${s.repMax}${ex.type === 'weighted' ? ` · +${s.increment} kg` : ''}`;
}

function TemplateEditor({ initial, exercises, onClose }: { initial: Template; exercises: Exercise[]; onClose: () => void }) {
  const [t, setT] = useState(initial);
  const [del, setDel] = useState(false);
  const exMap = new Map(exercises.map((e) => [e.id, e]));
  const sorted = [...exercises].sort((a, b) => a.name.localeCompare(b.name, 'de'));

  const setSlot = (i: number, patch: Partial<Slot>) =>
    setT({ ...t, slots: t.slots.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= t.slots.length) return;
    const slots = [...t.slots];
    [slots[i], slots[j]] = [slots[j], slots[i]];
    setT({ ...t, slots });
  };
  const addSlot = () => {
    if (!exercises.length) return;
    setT({
      ...t,
      slots: [...t.slots, { id: uid(), exerciseId: sorted[0].id, sets: 3, repMin: 6, repMax: 10, increment: 2.5, startWeight: 0, restSec: 120, progression: true }],
    });
  };
  const save = async () => {
    await db.templates.put(t);
    onClose();
  };

  return (
    <div className="screen">
      <header className="wo-head">
        <h1>Tag bearbeiten</h1>
        <button className="btn btn-ghost" onClick={onClose}>Abbrechen</button>
      </header>
      <label className="field">
        <span>Name</span>
        <input value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} />
      </label>
      <div className="field">
        <span>Wochentage</span>
        <div className="chips">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <button
              key={d}
              className={`chip ${t.weekdays.includes(d) ? 'chip-on' : ''}`}
              onClick={() => setT({ ...t, weekdays: t.weekdays.includes(d) ? t.weekdays.filter((x) => x !== d) : [...t.weekdays, d] })}
            >{WEEKDAYS[d]}</button>
          ))}
        </div>
      </div>

      {!isCardio(t) && (
      <>
      <div className="cards">
      {t.slots.map((s, i) => {
        const ex = exMap.get(s.exerciseId);
        const judged = s.progression && ex?.type !== 'hold';
        return (
          <section key={s.id} className="card">
            <div className="row">
              <select value={s.exerciseId} onChange={(e) => setSlot(i, { exerciseId: e.target.value })}>
                {sorted.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div className="grid">
              <label className="field"><span>Sätze</span><NumInput value={s.sets} onChange={(v) => setSlot(i, { sets: Math.max(1, v ?? 1) })} /></label>
              <label className="field"><span>Pause (s)</span><NumInput value={s.restSec} onChange={(v) => setSlot(i, { restSec: v ?? 0 })} /></label>
              {ex?.type !== 'hold' && (
                <>
                  <label className="field"><span>Wdh. min</span><NumInput value={s.repMin} onChange={(v) => setSlot(i, { repMin: v ?? 1 })} /></label>
                  <label className="field"><span>Wdh. max</span><NumInput value={s.repMax} onChange={(v) => setSlot(i, { repMax: v ?? 1 })} /></label>
                </>
              )}
              {ex?.type === 'weighted' && (
                <>
                  <label className="field"><span>+ kg pro Stufe</span><NumInput decimal value={s.increment} onChange={(v) => setSlot(i, { increment: v ?? 0 })} /></label>
                  <label className="field"><span>Startgewicht</span><NumInput decimal value={s.startWeight} onChange={(v) => setSlot(i, { startWeight: v ?? 0 })} /></label>
                </>
              )}
            </div>
            {ex?.type !== 'hold' && (
              <label className="toggle">
                <input type="checkbox" checked={s.progression} onChange={(e) => setSlot(i, { progression: e.target.checked })} />
                <span>Automatische Steigerung {judged ? '' : '(aus: frei, z. B. für Skills)'}</span>
              </label>
            )}
            <div className="row small-row">
              <button className="btn btn-small" onClick={() => move(i, -1)}>↑</button>
              <button className="btn btn-small" onClick={() => move(i, 1)}>↓</button>
              <button className="btn btn-small btn-ghost danger push-right" onClick={() => setT({ ...t, slots: t.slots.filter((_, j) => j !== i) })}>Entfernen</button>
            </div>
          </section>
        );
      })}
      </div>
      <button className="btn" onClick={addSlot}>+ Übung</button>
      </>
      )}

      <div className="wo-actions">
        <button className="btn btn-primary btn-big" onClick={save}>Speichern</button>
        {!del ? (
          <button className="btn btn-ghost danger" onClick={() => setDel(true)}>Trainingstag löschen</button>
        ) : (
          <div className="confirm">
            <p>Tag löschen? Bisherige Trainings bleiben im Verlauf.</p>
            <div className="row">
              <button className="btn btn-danger" onClick={async () => { await db.templates.delete(t.id); onClose(); }}>Löschen</button>
              <button className="btn" onClick={() => setDel(false)}>Abbrechen</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ExerciseLibrary({ exercises, templates }: { exercises: Exercise[]; templates: Template[] }) {
  const [name, setName] = useState('');
  const [type, setType] = useState<ExType>('reps');
  const used = new Set(templates.flatMap((t) => t.slots.map((s) => s.exerciseId)));
  const sorted = [...exercises].sort((a, b) => a.name.localeCompare(b.name, 'de'));

  const add = async () => {
    if (!name.trim()) return;
    await db.exercises.add({ id: uid(), name: name.trim(), type });
    setName('');
  };

  return (
    <section className="card readable">
      <div className="lib-new">
        <input placeholder="Neue Übung, z. B. Muscle-up Negatives" value={name} onChange={(e) => setName(e.target.value)} />
        <select value={type} onChange={(e) => setType(e.target.value as ExType)}>
          {(Object.keys(TYPE_LABEL) as ExType[]).map((k) => <option key={k} value={k}>{TYPE_LABEL[k]}</option>)}
        </select>
        <button className="btn btn-primary" onClick={add}>Hinzufügen</button>
      </div>
      <ul className="lib">
        {sorted.map((e) => (
          <li key={e.id}>
            <input defaultValue={e.name} onBlur={(ev) => ev.target.value.trim() && db.exercises.update(e.id, { name: ev.target.value.trim() })} />
            <select value={e.type} onChange={(ev) => db.exercises.update(e.id, { type: ev.target.value as ExType })}>
              {(Object.keys(TYPE_LABEL) as ExType[]).map((k) => <option key={k} value={k}>{TYPE_LABEL[k]}</option>)}
            </select>
            {!used.has(e.id) && <button className="btn btn-small btn-ghost danger" onClick={() => db.exercises.delete(e.id)} aria-label="Löschen">✕</button>}
          </li>
        ))}
      </ul>
      <p className="muted small">Übungen, die in einem Tag stecken, kann man erst nach dem Entfernen dort löschen.</p>
    </section>
  );
}
