import { useState } from 'react';
import type { Template } from '../db';
import { logCardio } from '../cardio';
import { NumInput } from './NumInput';

/** Cardio-Tag abhaken: Dauer und Notiz sind optional, ein Tipp auf "Erledigt" reicht. */
export function CardioCheck({ template, day, canLog = true, onLogged }: {
  template: Template;
  day?: string; // anderer Tag (YYYY-MM-DD); ohne = heute
  canLog?: boolean;
  onLogged?: () => void;
}) {
  const [minutes, setMinutes] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const done = async () => {
    if (busy) return;
    setBusy(true);
    await logCardio(template, day, minutes, note);
    setMinutes(null);
    setNote('');
    setBusy(false);
    onLogged?.();
  };

  if (!canLog) {
    return (
      <div className="cardio-check">
        <h2>{template.name}</h2>
        <p className="muted small">Cardio · abhaken</p>
      </div>
    );
  }
  return (
    <div className="cardio-check">
      <h2>{template.name}</h2>
      <div className="cardio-fields">
        <label className="field">
          <span>Dauer (min)</span>
          <NumInput value={minutes} onChange={setMinutes} placeholder="optional" />
        </label>
        <label className="field">
          <span>Notiz</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="z. B. Laufen" maxLength={60} enterKeyHint="done" />
        </label>
      </div>
      <button className="btn btn-primary btn-big" disabled={busy} onClick={done}>Erledigt</button>
    </div>
  );
}
