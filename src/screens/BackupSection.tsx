import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getMeta } from '../db';
import { exportBackup, importBackup } from '../backup';
import { resetAllInDb } from '../reset';
import { fmtDate } from '../util';

export function BackupSection({ toast, onReset }: { toast: (m: string) => void; onReset: () => void }) {
  const lastBackup = useLiveQuery(() => getMeta<number | null>('lastBackup', null), []);
  const count = useLiveQuery(() => db.sessions.count(), []);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [pending, setPending] = useState<File | null>(null);
  const [wipe, setWipe] = useState<null | 1 | 2>(null);
  const [wiping, setWiping] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const wipingRef = useRef(false); // schneller Doppeltipp: der State ist im selben Frame noch nicht aktualisiert
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

  useEffect(() => {
    void navigator.storage?.persisted?.().then(setPersisted);
  }, []);

  const doExport = async () => {
    const r = await exportBackup();
    if (r !== 'cancelled') toast('Backup erstellt');
  };
  const doImport = async () => {
    if (!pending) return;
    try {
      const n = await importBackup(pending);
      toast(`${n} Trainings wiederhergestellt`);
    } catch (e) {
      toast((e as Error).message);
    }
    setPending(null);
  };
  const doReset = async () => {
    if (wipingRef.current) return;
    wipingRef.current = true;
    setWiping(true);
    try {
      await resetAllInDb();
      toast('Alle Daten gelöscht');
      onReset();
    } catch (e) {
      toast((e as Error).message);
      wipingRef.current = false;
      setWiping(false);
    }
  };

  return (
    <>
      <h1 className="mt" id="backup">Daten &amp; Backup</h1>
      <section className="card readable">
        <p>Deine Daten liegen nur auf diesem Gerät. Sichere sie regelmäßig, z. B. in iCloud Drive („In Dateien sichern“).</p>
        <p className="muted small">{count ?? 0} Trainings gespeichert · letztes Backup: {lastBackup ? fmtDate(lastBackup) : 'noch nie'}</p>
        <button className="btn btn-primary btn-big" onClick={doExport}>Backup exportieren</button>
        <button className="btn btn-ghost danger" onClick={() => fileRef.current?.click()}>Backup laden</button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => setPending(e.target.files?.[0] ?? null)} />
        {pending && (
          <div className="confirm">
            <p>„{pending.name}“ importieren? Das <b>ersetzt</b> alle Daten auf diesem Gerät.</p>
            <div className="row">
              <button className="btn btn-danger" onClick={doImport}>Ersetzen</button>
              <button className="btn" onClick={() => { setPending(null); if (fileRef.current) fileRef.current.value = ''; }}>Abbrechen</button>
            </div>
          </div>
        )}
        {wipe === null && <button className="btn btn-ghost danger" onClick={() => setWipe(1)}>Alle Daten löschen</button>}
        {wipe === 1 && (
          <div className="confirm">
            <p>Löscht alle Trainings, Gewichte, Tageswerte, den Plan und das Profil. Das lässt sich nicht rückgängig machen. Mach vorher ein Backup.</p>
            <p className="muted small">Die Apple-Health-Verbindung und die Darstellung (Hell/Dunkel) bleiben erhalten.</p>
            <div className="row">
              <button className="btn" onClick={doExport}>Backup exportieren</button>
              <button className="btn" onClick={() => setWipe(2)}>Weiter</button>
              <button className="btn" onClick={() => setWipe(null)}>Abbrechen</button>
            </div>
          </div>
        )}
        {wipe === 2 && (
          <div className="confirm">
            <p>Wirklich alle Daten endgültig löschen?</p>
            <div className="row">
              <button className="btn btn-danger" disabled={wiping} onClick={doReset}>Endgültig löschen</button>
              <button className="btn" disabled={wiping} onClick={() => setWipe(null)}>Abbrechen</button>
            </div>
          </div>
        )}
      </section>

      <section className="card readable">
        {!standalone ? (
          <p>⚠️ Du nutzt die Seite im Browser. Installiere sie: <b>Teilen → „Zum Home-Bildschirm“</b>. Nur dann bleiben die Daten auf dem iPhone sicher gespeichert und die App läuft offline.</p>
        ) : (
          <p>✅ Als App installiert, läuft auch offline.</p>
        )}
        <p className="muted small">Dauerhafter Speicher: {persisted == null ? 'unbekannt' : persisted ? 'ja' : 'nein (Backups umso wichtiger)'}</p>
        <p className="muted small">Version {__APP_VERSION__}</p>
      </section>
    </>
  );
}
