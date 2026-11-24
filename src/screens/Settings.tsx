import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getMeta, setMeta } from '../db';
import { NumInput } from '../components/NumInput';
import { fmtDate } from '../util';
import { dayKey, dayTs, fmtWeight, weightSummary } from '../weight';
import { ageOn, isValidBirthDate, isValidBodyFat, isValidHeight, parseProfile, type Gender, type Profile } from '../profile';
import type { HistoryTab } from './History';
import { parseThemePref, type ThemePref } from '../theme';
import { BackupSection } from './BackupSection';
import { HealthSection } from './HealthSection';
import { isValidKcalGoal, isValidProteinGoal, isValidStepsGoal, parseGoals, type Goals } from '../dayValues';

export function Settings({ toast, onBack, goHistory }: {
  toast: (m: string) => void;
  onBack: () => void;
  goHistory: (tab: HistoryTab) => void;
}) {
  const stored = useLiveQuery(async () => ({ value: await getMeta<unknown>('profile', undefined) }), []);
  return (
    <div className="screen">
      <header className="wo-head readable">
        <h1>Einstellungen</h1>
        <button className="btn btn-ghost" onClick={onBack}>Zurück</button>
      </header>
      {stored && <ProfileCard profile={parseProfile(stored.value, Date.now())} goHistory={goHistory} />}
      <ThemeCard />
      <HealthSection toast={toast} />
      <BackupSection toast={toast} />
    </div>
  );
}

function ProfileCard({ profile, goHistory }: { profile: Profile; goHistory: (tab: HistoryTab) => void }) {
  const weights = useLiveQuery(() => db.weights.toArray(), []);
  const [name, setName] = useState(profile.name ?? '');
  const [birth, setBirth] = useState(profile.birthDate ?? '');
  const [bad, setBad] = useState<Partial<Record<'heightCm' | 'bodyFat' | 'birthDate', boolean>>>({});

  // Nach einem Backup-Import ändert sich das gespeicherte Profil von außen.
  useEffect(() => { setName((n) => (n.trim() === (profile.name ?? '') ? n : profile.name ?? '')); }, [profile.name]);
  useEffect(() => { setBirth(profile.birthDate ?? ''); }, [profile.birthDate]);

  // Liest das gespeicherte Profil frisch, damit schnelle Eingaben in mehreren Feldern sich nicht überschreiben.
  const save = (patch: Partial<Profile>) =>
    db.transaction('rw', db.meta, async () => {
      const next: Profile = { ...parseProfile(await getMeta<unknown>('profile', undefined), Date.now()), ...patch };
      for (const k of Object.keys(next) as (keyof Profile)[]) if (next[k] === undefined) delete next[k];
      await setMeta('profile', next);
    });
  const mark = (k: 'heightCm' | 'bodyFat' | 'birthDate', isBad: boolean) => setBad((b) => ({ ...b, [k]: isBad }));

  const now = Date.now();
  const yesterday = dayKey(now - 864e5);
  const sorted = (weights ?? []).slice().sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1];
  const summary = weightSummary(sorted);

  return (
    <>
      <h1 className="mt">Profil</h1>
      <section className="card readable settings-form">
        <label className="field">Name
          <input
            type="text"
            maxLength={40}
            value={name}
            onChange={(e) => { setName(e.target.value); void save({ name: e.target.value.trim() || undefined }); }}
          />
        </label>
        <label className="field">Geschlecht
          <select value={profile.gender ?? ''} onChange={(e) => void save({ gender: (e.target.value || undefined) as Gender | undefined })}>
            <option value="">–</option>
            <option value="male">männlich</option>
            <option value="female">weiblich</option>
            <option value="diverse">divers</option>
          </select>
        </label>
        <label className="field">Größe (cm)
          <NumInput
            value={profile.heightCm ?? null}
            onChange={(v) => {
              if (v == null) { mark('heightCm', false); void save({ heightCm: undefined }); }
              else if (Number.isInteger(v) && isValidHeight(v)) { mark('heightCm', false); void save({ heightCm: v }); }
              else mark('heightCm', true);
            }}
          />
          {bad.heightCm && <span className="hint-warn">100–250 cm</span>}
        </label>
        <label className="field">Geburtsdatum
          <input
            type="date"
            max={yesterday}
            value={birth}
            onChange={(e) => {
              const v = e.target.value;
              setBirth(v);
              if (!v) { mark('birthDate', false); void save({ birthDate: undefined }); }
              else if (isValidBirthDate(v, Date.now())) { mark('birthDate', false); void save({ birthDate: v }); }
              else mark('birthDate', true);
            }}
          />
          {bad.birthDate && <span className="hint-warn">Datum muss in der Vergangenheit liegen</span>}
          {profile.birthDate && !bad.birthDate && <span>{ageOn(profile.birthDate, now)} Jahre</span>}
        </label>
        <label className="field">Körperfett (%)
          <NumInput
            decimal
            value={profile.bodyFat ?? null}
            onChange={(v) => {
              if (v == null) { mark('bodyFat', false); void save({ bodyFat: undefined, bodyFatDate: undefined }); }
              else if (isValidBodyFat(v)) {
                mark('bodyFat', false);
                if (v !== profile.bodyFat) void save({ bodyFat: v, bodyFatDate: dayKey(Date.now()) });
              } else mark('bodyFat', true);
            }}
          />
          {bad.bodyFat && <span className="hint-warn">3–60 %</span>}
          {profile.bodyFat != null && profile.bodyFatDate && !bad.bodyFat && <span>geändert am {fmtDate(dayTs(profile.bodyFatDate))}</span>}
        </label>
        <GoalFields />
        <div className="field">Gewicht
          {latest && summary ? (
            <>
              <span className="settings-val">{fmtWeight(latest.kg)} kg am {fmtDate(dayTs(latest.date))}</span>
              <span>Ø {fmtWeight(summary.avg)} kg (7 Tage)</span>
            </>
          ) : (
            <span>Noch kein Gewicht eingetragen</span>
          )}
          <button className="btn btn-ghost" onClick={() => goHistory('weights')}>Verlauf → Gewicht</button>
        </div>
      </section>
    </>
  );
}

const GOAL_FIELDS: { key: keyof Goals; label: string; valid: (n: unknown) => boolean; range: string }[] = [
  { key: 'kcal', label: 'Kalorienziel (kcal)', valid: isValidKcalGoal, range: '1000–6000 kcal' },
  { key: 'proteinG', label: 'Proteinziel (g)', valid: isValidProteinGoal, range: '20–400 g' },
  { key: 'steps', label: 'Schrittziel', valid: isValidStepsGoal, range: '1000–50000 Schritte' },
];

/** Ziele in meta `goals`; ein geleertes Feld entfernt das Ziel, dann gilt der Standard. */
function GoalFields() {
  const stored = useLiveQuery(async () => ({ value: await getMeta<unknown>('goals', undefined) }), []);
  const [bad, setBad] = useState<Partial<Record<keyof Goals, boolean>>>({});
  // Neu aufbauen, damit ein geleertes Feld nach dem Verlassen wieder das geltende Ziel zeigt.
  const [rev, setRev] = useState<Partial<Record<keyof Goals, number>>>({});
  if (!stored) return null;
  const goals = parseGoals(stored.value);

  const save = (key: keyof Goals, value: number | undefined) =>
    db.transaction('rw', db.meta, async () => {
      const raw = await getMeta<unknown>('goals', undefined);
      const next: Record<string, unknown> = raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...raw } : {};
      if (value === undefined) delete next[key];
      else next[key] = value;
      await setMeta('goals', next);
    });

  return (
    <>
      {GOAL_FIELDS.map((f) => (
        <label
          className="field"
          key={f.key}
          onBlur={(e) => { const t = e.target as EventTarget; if (t instanceof HTMLInputElement && !t.value) setRev((r) => ({ ...r, [f.key]: (r[f.key] ?? 0) + 1 })); }}
        >{f.label}
          <NumInput
            key={rev[f.key] ?? 0}
            value={goals[f.key]}
            onChange={(v) => {
              if (v == null) { setBad((b) => ({ ...b, [f.key]: false })); void save(f.key, undefined); }
              else if (f.valid(v)) { setBad((b) => ({ ...b, [f.key]: false })); void save(f.key, v); }
              else setBad((b) => ({ ...b, [f.key]: true }));
            }}
          />
          {bad[f.key] && <span className="hint-warn">{f.range}</span>}
        </label>
      ))}
    </>
  );
}

const THEMES: [ThemePref, string][] = [['dark', 'Dunkel'], ['light', 'Hell'], ['system', 'System']];

function ThemeCard() {
  const stored = useLiveQuery(async () => ({ value: await getMeta<unknown>('theme', undefined) }), []);
  const current = parseThemePref(stored?.value);
  return (
    <>
      <h1 className="mt">Darstellung</h1>
      <section className="card readable">
        <div className="seg seg-tall">
          {THEMES.map(([pref, label]) => (
            <button key={pref} className={current === pref ? 'on' : ''} aria-pressed={current === pref} onClick={() => void setMeta('theme', pref)}>
              {label}
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
