import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getMeta, setMeta } from '../db';
import { NumInput } from '../components/NumInput';
import { fmtDate } from '../util';
import { dayKey, dayTs, fmtWeight, weightSummary } from '../weight';
import { ageOn, isValidBirthDate, isValidBodyFat, isValidHeight, parseProfile, type Gender, type Profile } from '../profile';
import type { HistoryTab } from './History';
import { BackupSection } from './BackupSection';

export function Settings({ toast, onBack, goHistory }: {
  toast: (m: string) => void;
  onBack: () => void;
  goHistory: (tab: HistoryTab) => void;
}) {
  const stored = useLiveQuery(async () => ({ value: await getMeta<unknown>('profile', undefined) }), []);
  return (
    <div className="screen">
      <header className="wo-head">
        <h1>Einstellungen</h1>
        <button className="btn btn-ghost" onClick={onBack}>Zurück</button>
      </header>
      {stored && <ProfileCard profile={parseProfile(stored.value, Date.now())} goHistory={goHistory} />}
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
