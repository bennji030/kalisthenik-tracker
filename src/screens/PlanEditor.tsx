import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type EntryLog, type Exercise, type ExType, type Slot, type Template } from '../db';
import { NumInput } from '../components/NumInput';
import { Sheet } from '../components/Sheet';
import { uid, WEEKDAYS } from '../util';
import { isCardio } from '../cardio';
import { DEFAULT_SLOT } from '../addedExercise';
import { MUSCLES, parseMuscles, type Muscle } from '../muscles';
import { cleanSlot, dropIndex, moveSlot, previewText, slotSummary } from '../planEdit';
import { suggest } from '../progression';
import { slotHistory } from '../sessions';

export const TYPE_LABEL: Record<ExType, string> = { weighted: 'Wdh. + Gewicht', reps: 'Wdh.', hold: 'Haltezeit' };

// Jede Änderung liest den Tag frisch aus der Datenbank und schreibt nur ihren Teil zurück.
function changeSlots(templateId: string, change: (slots: Slot[]) => Slot[]): Promise<void> {
  return db.transaction('rw', db.templates, async () => {
    const t = await db.templates.get(templateId);
    if (t) await db.templates.update(templateId, { slots: change(t.slots) });
  });
}

/** Schiebt die Übung an die Stelle der Übung `targetId`; beide über ihre id, nicht über den Index. */
function reorderSlot(templateId: string, slotId: string, targetId: string): Promise<void> {
  return changeSlots(templateId, (slots) =>
    moveSlot(slots, slots.findIndex((s) => s.id === slotId), slots.findIndex((s) => s.id === targetId)));
}

function saveSlot(templateId: string, slot: Slot): Promise<void> {
  return changeSlots(templateId, (slots) =>
    slots.some((s) => s.id === slot.id) ? slots.map((s) => (s.id === slot.id ? slot : s)) : [...slots, slot]);
}

function removeSlot(templateId: string, slotId: string): Promise<void> {
  return changeSlots(templateId, (slots) => slots.filter((s) => s.id !== slotId));
}

function saveDay(t: Template, isNew: boolean): Promise<void> {
  return db.transaction('rw', db.templates, async () => {
    if (isNew) await db.templates.put(t);
    else await db.templates.update(t.id, { name: t.name, weekdays: t.weekdays });
  });
}

interface SlotEdit { templateId: string; slot: Slot; isNew: boolean }
interface DayEdit { template: Template; isNew: boolean }

export function PlanScreen() {
  const templates = useLiveQuery(() => db.templates.orderBy('order').toArray(), []);
  const exercises = useLiveQuery(() => db.exercises.toArray(), []);
  const [slotEdit, setSlotEdit] = useState<SlotEdit | null>(null);
  const [dayEdit, setDayEdit] = useState<DayEdit | null>(null);
  const [showLib, setShowLib] = useState(false);
  if (!templates || !exercises) return <div className="screen" />;
  const exMap = new Map(exercises.map((e) => [e.id, e]));
  const sorted = [...exercises].sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const slotTemplate = slotEdit && templates.find((t) => t.id === slotEdit.templateId);

  const addDay = (name: string, kind?: 'cardio') =>
    setDayEdit({ template: { id: uid(), name, weekdays: [], order: templates.length, slots: [], ...(kind ? { kind } : {}) }, isNew: true });
  const addSlot = (t: Template) =>
    setSlotEdit({ templateId: t.id, slot: { id: uid(), exerciseId: sorted[0].id, ...DEFAULT_SLOT }, isNew: true });

  return (
    <div className="screen">
      <h1>Plan</h1>
      <p className="muted small">Änderungen gelten ab dem nächsten Training. Der Verlauf bleibt erhalten.</p>
      <div className="cards">
      {templates.map((t) => (
        <section key={t.id} className="card">
          <button className="card-toggle day-head" aria-label={`Tag bearbeiten: ${t.name}`} onClick={() => setDayEdit({ template: t, isNew: false })}>
            <div>
              <h2>{t.name}</h2>
              <p className="muted small">{t.weekdays.map((d) => WEEKDAYS[d]).join(', ') || 'kein fester Tag'}</p>
            </div>
            <span className="muted day-chevron" aria-hidden="true">›</span>
          </button>
          {isCardio(t) ? (
            <p className="muted small">Cardio · abhaken</p>
          ) : (
            <>
              <SlotList template={t} exMap={exMap} onOpen={(slot) => setSlotEdit({ templateId: t.id, slot, isNew: false })} />
              <button className="btn slot-add" disabled={!sorted.length} onClick={() => addSlot(t)}>+ Übung</button>
            </>
          )}
        </section>
      ))}
      </div>
      <div className="plan-add">
        <button className="btn" onClick={() => addDay('Neuer Tag')}>+ Trainingstag</button>
        <button className="btn" onClick={() => addDay('Cardio', 'cardio')}>+ Cardio-Tag</button>
      </div>

      <h1 className="mt">Übungen</h1>
      <button className="btn" onClick={() => setShowLib(!showLib)}>{showLib ? 'Übungsliste schließen' : 'Übungsliste bearbeiten'}</button>
      {showLib && <ExerciseLibrary exercises={exercises} templates={templates} />}

      {slotEdit && slotTemplate && (
        <SlotSheet template={slotTemplate} initial={slotEdit.slot} isNew={slotEdit.isNew} exercises={sorted} onClose={() => setSlotEdit(null)} />
      )}
      {dayEdit && <DaySheet initial={dayEdit.template} isNew={dayEdit.isNew} onClose={() => setDayEdit(null)} />}
    </div>
  );
}

interface Drag { id: string; from: number; startY: number; dy: number; heights: number[] }

function SlotList({ template: t, exMap, onOpen }: { template: Template; exMap: Map<string, Exercise>; onOpen: (slot: Slot) => void }) {
  const listRef = useRef<HTMLUListElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  // Neue Reihenfolge sofort zeigen, bis die Datenbank sie zurückmeldet.
  const [pending, setPending] = useState<Slot[] | null>(null);
  useEffect(() => setPending(null), [t.slots]);
  const slots = pending ?? t.slots;
  const to = drag ? dropIndex(drag.from, drag.dy, drag.heights) : -1;

  const down = (e: PointerEvent<HTMLButtonElement>, i: number) => {
    if (drag || pending || !listRef.current) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const heights = Array.from(listRef.current.children, (li) => li.getBoundingClientRect().height);
    setDrag({ id: slots[i].id, from: i, startY: e.clientY, dy: 0, heights });
  };
  const move = (e: PointerEvent) => {
    if (!drag) return;
    const sum = (hs: number[]) => hs.reduce((a, h) => a + h, 0);
    const min = -sum(drag.heights.slice(0, drag.from));
    const max = sum(drag.heights.slice(drag.from + 1));
    setDrag({ ...drag, dy: Math.min(max, Math.max(min, e.clientY - drag.startY)) });
  };
  const up = () => {
    if (!drag) return;
    setDrag(null);
    if (to === drag.from) return;
    setPending(moveSlot(slots, drag.from, to));
    reorderSlot(t.id, drag.id, slots[to].id).catch(() => setPending(null));
  };
  const shift = (i: number) => {
    if (!drag) return undefined;
    if (i === drag.from) return { transform: `translateY(${drag.dy}px)` };
    const h = drag.heights[drag.from];
    if (i > drag.from && i <= to) return { transform: `translateY(${-h}px)` };
    if (i < drag.from && i >= to) return { transform: `translateY(${h}px)` };
    return undefined;
  };

  return (
    <ul className={`slots ${drag ? 'slots-dragging' : ''}`} ref={listRef}>
      {slots.map((s, i) => {
        const ex = exMap.get(s.exerciseId);
        return (
          <li key={s.id} className={drag?.from === i ? 'slot-drag' : ''} style={shift(i)}>
            <button className="slot-main" onClick={() => onOpen(s)}>
              <span className="slot-name">{ex?.name ?? '?'}</span>
              <span className="muted small">{slotSummary(s, ex)}</span>
            </button>
            <button
              className="slot-handle"
              aria-label="Übung verschieben"
              data-no-swipe
              onPointerDown={(e) => down(e, i)}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={() => setDrag(null)}
              onLostPointerCapture={() => setDrag(null)}
              onContextMenu={(e) => e.preventDefault()}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14M5 12h14M5 16h14" /></svg>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

const num = (v: number) => (Number.isFinite(v) ? v : null);

function SlotSheet({ template, initial, isNew, exercises, onClose }: {
  template: Template; initial: Slot; isNew: boolean; exercises: Exercise[]; onClose: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [history, setHistory] = useState<EntryLog[]>([]);
  const [del, setDel] = useState(false);
  useEffect(() => {
    if (isNew) return;
    let live = true;
    void slotHistory(template.id, initial).then((h) => { if (live) setHistory(h.map((x) => x.entry)); });
    return () => { live = false; };
  }, [template.id, initial, isNew]);

  const set = (patch: Partial<Slot>) => setDraft({ ...draft, ...patch });
  const ex = exercises.find((e) => e.id === draft.exerciseId);
  const type = ex?.type;
  const suggestion = type && suggest(cleanSlot(draft), type, history);
  const pos = template.slots.findIndex((s) => s.id === draft.id);
  const shiftBy = (d: number) => reorderSlot(template.id, draft.id, template.slots[pos + d].id);
  const save = async () => {
    await saveSlot(template.id, cleanSlot(draft));
    onClose();
  };

  return (
    <Sheet title={isNew ? 'Neue Übung' : (ex?.name ?? 'Übung')}>
      <label className="field">
        <span>Übung</span>
        <select value={draft.exerciseId} onChange={(e) => set({ exerciseId: e.target.value })}>
          {exercises.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </label>
      <div className="grid">
        <label className="field"><span>Sätze</span><NumInput value={num(draft.sets)} onChange={(v) => set({ sets: v ?? NaN })} /></label>
        <label className="field"><span>Pause (s)</span><NumInput value={num(draft.restSec)} onChange={(v) => set({ restSec: v ?? NaN })} /></label>
        {type !== 'hold' && (
          <>
            <label className="field"><span>Wdh. min</span><NumInput value={num(draft.repMin)} onChange={(v) => set({ repMin: v ?? NaN })} /></label>
            <label className="field"><span>Wdh. max</span><NumInput value={num(draft.repMax)} onChange={(v) => set({ repMax: v ?? NaN })} /></label>
          </>
        )}
      </div>
      {type !== 'hold' && (
        <p className="muted small">Du steigerst dich Wiederholung für Wiederholung von min bis max (z. B. 4,4,4,4 → 5,4,4,4). Schaffst du in allen Sätzen max, geht es mit mehr Gewicht wieder bei min los.</p>
      )}
      {type === 'weighted' && (
        <>
          <label className="field"><span>Startgewicht</span><NumInput decimal value={num(draft.startWeight)} onChange={(v) => set({ startWeight: v ?? NaN })} /></label>
          <p className="muted small">Zusatzgewicht beim allerersten Mal. Danach zählt, was du zuletzt geschafft hast.</p>
          <label className="field"><span>+ kg pro Stufe</span><NumInput decimal value={num(draft.increment)} onChange={(v) => set({ increment: v ?? NaN })} /></label>
          <p className="muted small">So viel kommt dazu, wenn alle Sätze oben im Bereich sind. 3× in Folge verfehlt: etwa −10 % und neu aufbauen.</p>
        </>
      )}
      {type !== 'hold' && (
        <>
          <label className="toggle">
            <input type="checkbox" checked={draft.progression} onChange={(e) => set({ progression: e.target.checked })} />
            <span>Automatische Steigerung</span>
          </label>
          <p className="muted small">An: die App schlägt jedes Mal das nächste Ziel vor (doppelte Progression). Aus: frei, z. B. für Skills; die Werte vom letzten Mal werden vorgeschlagen, nichts wird bewertet.</p>
        </>
      )}
      {type && suggestion && (
        <div className="sheet-preview">
          <p>{previewText(suggestion, type)}</p>
          <p className="muted small">{suggestion.label}</p>
        </div>
      )}
      {!isNew && (
        <>
          <div className="grid">
            <button className="btn" disabled={pos <= 0} onClick={() => shiftBy(-1)}>Nach oben</button>
            <button className="btn" disabled={pos < 0 || pos >= template.slots.length - 1} onClick={() => shiftBy(1)}>Nach unten</button>
          </div>
          {!del ? (
            <button className="btn btn-ghost danger" onClick={() => setDel(true)}>Übung entfernen</button>
          ) : (
            <div className="confirm confirm-inset">
              <p>Übung aus diesem Tag entfernen? Bisherige Trainings bleiben im Verlauf.</p>
              <div className="row">
                <button className="btn btn-danger" onClick={async () => { await removeSlot(template.id, draft.id); onClose(); }}>Entfernen</button>
                <button className="btn" onClick={() => setDel(false)}>Abbrechen</button>
              </div>
            </div>
          )}
        </>
      )}
      <div className="sheet-actions">
        <button className="btn btn-primary btn-big" onClick={save}>Speichern</button>
        <button className="btn btn-big" onClick={onClose}>Abbrechen</button>
      </div>
    </Sheet>
  );
}

function DaySheet({ initial, isNew, onClose }: { initial: Template; isNew: boolean; onClose: () => void }) {
  const [t, setT] = useState(initial);
  const [del, setDel] = useState(false);
  const save = async () => {
    await saveDay({ ...t, name: t.name.trim() }, isNew);
    onClose();
  };

  return (
    <Sheet title={isNew ? 'Neuer Tag' : 'Tag bearbeiten'}>
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
              aria-pressed={t.weekdays.includes(d)}
              onClick={() => setT({ ...t, weekdays: t.weekdays.includes(d) ? t.weekdays.filter((x) => x !== d) : [...t.weekdays, d] })}
            >{WEEKDAYS[d]}</button>
          ))}
        </div>
      </div>
      <div className="sheet-actions">
        <button className="btn btn-primary btn-big" disabled={!t.name.trim()} onClick={save}>Speichern</button>
        <button className="btn btn-big" onClick={onClose}>Abbrechen</button>
      </div>
      {!isNew && (!del ? (
        <button className="btn btn-ghost danger" onClick={() => setDel(true)}>Trainingstag löschen</button>
      ) : (
        <div className="confirm confirm-inset">
          <p>Tag löschen? Bisherige Trainings bleiben im Verlauf.</p>
          <div className="row">
            <button className="btn btn-danger" onClick={async () => { await db.templates.delete(t.id); onClose(); }}>Löschen</button>
            <button className="btn" onClick={() => setDel(false)}>Abbrechen</button>
          </div>
        </div>
      ))}
    </Sheet>
  );
}

function ExerciseLibrary({ exercises, templates }: { exercises: Exercise[]; templates: Template[] }) {
  const [name, setName] = useState('');
  const [type, setType] = useState<ExType>('reps');
  const [open, setOpen] = useState<string | null>(null);
  const used = new Set(templates.flatMap((t) => t.slots.map((s) => s.exerciseId)));
  const sorted = [...exercises].sort((a, b) => a.name.localeCompare(b.name, 'de'));

  const add = async () => {
    if (!name.trim()) return;
    await db.exercises.add({ id: uid(), name: name.trim(), type });
    setName('');
  };
  const toggleMuscle = (e: Exercise, m: Muscle) => {
    const cur = parseMuscles(e.muscles);
    const muscles = parseMuscles(MUSCLES.map((x) => x.id).filter((id) => (id === m) !== cur.includes(id)));
    return db.exercises.update(e.id, { muscles });
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
            <button className="lib-muscles" aria-expanded={open === e.id} onClick={() => setOpen(open === e.id ? null : e.id)}>
              <span className="muted small">Muskeln</span>
              <span className="small">{MUSCLES.filter((m) => parseMuscles(e.muscles).includes(m.id)).map((m) => m.label).join(', ') || 'keine'}</span>
            </button>
            {open === e.id && (
              <div className="chips chips-wrap">
                {MUSCLES.map((m) => {
                  const on = parseMuscles(e.muscles).includes(m.id);
                  return (
                    <button key={m.id} className={`chip ${on ? 'chip-on' : ''}`} aria-pressed={on} onClick={() => toggleMuscle(e, m.id)}>{m.label}</button>
                  );
                })}
              </div>
            )}
          </li>
        ))}
      </ul>
      <p className="muted small">Übungen, die in einem Tag stecken, kann man erst nach dem Entfernen dort löschen.</p>
    </section>
  );
}
