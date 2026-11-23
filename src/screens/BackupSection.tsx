import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getMeta } from '../db';
import { exportBackup, importBackup } from '../backup';
import { fmtDate } from '../util';

export function BackupSection({ toast }: { toast: (m: string) => void }) {
  const lastBackup = useLiveQuery(() => getMeta<number | null>('lastBackup', null), []);
  const count = useLiveQuery(() => db.sessions.count(), []);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [pending, setPending] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
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
