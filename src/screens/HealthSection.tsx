import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getMeta, setMeta } from '../db';
import {
  DEFAULT_SHORTCUT, isConfigured, isValidServerUrl, isValidToken, maskToken, normalizeUrl, parseHealthConfig,
  parseHealthStatus, type HealthConfig,
} from '../health';
import { syncHealth } from '../healthSync';
import { useSyncRunning } from '../useHealthSync';
import { fmtDate } from '../util';

export function HealthSection({ toast }: { toast: (m: string) => void }) {
  const stored = useLiveQuery(async () => ({
    config: await getMeta<unknown>('health', undefined),
    status: parseHealthStatus(await getMeta<unknown>('healthStatus', undefined)),
  }), []);
  return (
    <>
      <h1 className="mt">Apple Health</h1>
      {stored && <HealthCard initial={stored.config} status={stored.status} toast={toast} />}
    </>
  );
}

const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

function HealthCard({ initial, status, toast }: {
  initial: unknown;
  status: ReturnType<typeof parseHealthStatus>;
  toast: (m: string) => void;
}) {
  const start = parseHealthConfig(initial);
  const rawShortcut = initial && typeof initial === 'object' && typeof (initial as { shortcut?: unknown }).shortcut === 'string'
    ? (initial as { shortcut: string }).shortcut : '';
  const [url, setUrl] = useState(start.url);
  const [token, setToken] = useState(start.token);
  const [shortcut, setShortcut] = useState(rawShortcut);
  const [result, setResult] = useState<string | null>(null);
  const [guide, setGuide] = useState(false);
  const running = useSyncRunning();

  const config: HealthConfig = { url, token, shortcut: shortcut.trim() || DEFAULT_SHORTCUT };
  const configured = isConfigured(config);

  // Liest die gespeicherte Einstellung frisch, damit schnelle Eingaben in mehreren Feldern sich nicht überschreiben.
  const save = (patch: Partial<HealthConfig>) => {
    setResult(null);
    return db.transaction('rw', db.meta, async () => {
      await setMeta('health', { ...parseHealthConfig(await getMeta<unknown>('health', undefined)), ...patch });
    });
  };

  const test = async () => {
    setResult(null);
    const r = await syncHealth(true);
    if (r && r.kind !== 'skipped') setResult(r.error ?? 'Verbindung ok');
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast('Kopiert');
    } catch {
      toast('Kopieren nicht möglich');
    }
  };

  const base = isValidServerUrl(url) ? normalizeUrl(url) : null;

  return (
    <section className="card readable settings-form">
      <label className="field">Server-Adresse
        <input
          type="url"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="https://…"
          value={url}
          onChange={(e) => { setUrl(e.target.value); void save({ url: e.target.value.trim() }); }}
        />
        {url.trim() !== '' && !isValidServerUrl(url) && <span className="hint-warn">Adresse mit https://</span>}
      </label>
      <label className="field">Schlüssel
        <input
          type="password"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          value={token}
          onChange={(e) => { setToken(e.target.value); void save({ token: e.target.value }); }}
        />
        {token !== '' && !isValidToken(token) && <span className="hint-warn">Schlüssel ohne Leerzeichen</span>}
      </label>
      <label className="field">Kurzbefehl-Name
        <input
          type="text"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder={DEFAULT_SHORTCUT}
          value={shortcut}
          onChange={(e) => { setShortcut(e.target.value); void save({ shortcut: e.target.value.trim() || DEFAULT_SHORTCUT }); }}
        />
      </label>
      {!configured ? (
        <p className="muted small">Noch nicht eingerichtet</p>
      ) : (
        <div>
          <p className="muted small">{status.lastSync ? `Letzte Aktualisierung: ${fmtDate(status.lastSync)} ${fmtTime(status.lastSync)}` : 'Noch nie aktualisiert'}</p>
          {status.error && <p className="muted small">{status.error}</p>}
        </div>
      )}
      <button className="btn" disabled={!configured || running} onClick={test}>Verbindung testen</button>
      {result && <p className="small" role="status">{result}</p>}
      <button className="btn btn-ghost" aria-expanded={guide} onClick={() => setGuide((g) => !g)}>Einrichten</button>
      {guide && <Guide base={base} token={isValidToken(token) ? token : null} shortcut={config.shortcut} copy={copy} />}
    </section>
  );
}

function Guide({ base, token, shortcut, copy }: {
  base: string | null;
  token: string | null;
  shortcut: string;
  copy: (text: string) => void;
}) {
  const server = base ?? '<Server>';
  return (
    <div className="health-guide">
      <div className="copy-row">
        <span className="copy-label">Server</span>
        <code>{server}</code>
        <button className="btn btn-small" disabled={!base} onClick={() => base && copy(base)}>Kopieren</button>
      </div>
      <div className="copy-row">
        <span className="copy-label">Schlüssel</span>
        <code>{token ? maskToken(token) : '<Schlüssel>'}</code>
        <button className="btn btn-small" disabled={!token} onClick={() => token && copy(token)}>Kopieren</button>
      </div>
      <ol>
        <li>
          <b>MyFitnessPal:</b> „Apps &amp; Geräte“ → „Health“ → „Nahrungsenergie“ und „Protein“ teilen.
        </li>
        <li>
          <b>Kurzbefehl „{shortcut}“</b> in der App Kurzbefehle anlegen:
          <ul>
            <li>„Health-Samples suchen“, je eine für „Schritte“, „Nahrungsenergie“ und „Protein“, ab heute</li>
            <li>„Statistiken berechnen“ mit „Summe“ für jede der drei</li>
            <li>„Datum formatieren“ (heute) mit eigenem Format <code>yyyy-MM-dd</code></li>
            <li>
              „Inhalte von URL abrufen“: Methode <code>PUT</code>, URL <code>{server}/v1/days/&lt;Datum&gt;</code>,
              Header <code>Authorization</code> = <code>Bearer &lt;Schlüssel&gt;</code>, Hauptteil JSON mit den
              Feldern <code>steps</code>, <code>kcal</code>, <code>proteinG</code>
            </li>
          </ul>
        </li>
        <li>
          <b>Automation:</b> Kurzbefehle → Automation → „Tageszeit“, eine Automation pro Stunde (z. B. 7–22 Uhr),
          „Sofort ausführen“, Mitteilung aus.
        </li>
        <li>
          <b>Optional:</b> Automation „App wird geöffnet“. Wenn sich die Calisthenics-Web-App dort auswählen lässt,
          holt sie bei jedem Öffnen frische Werte.
        </li>
      </ol>
    </div>
  );
}
