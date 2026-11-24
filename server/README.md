# Mini-Server für Health-Tageswerte

Ein kleiner Server (Cloudflare Worker), der die Tageswerte aus Apple Health
weiterreicht: Schritte, Kalorien und Protein pro Tag. Ein iOS-Kurzbefehl schickt
die Werte hierher, die App holt sie später ab.

- Die App funktioniert vollständig ohne diesen Server. Er ist nur ein optionaler
  Briefkasten für die Health-Werte.
- Gespeichert werden nur Datum, Schritte, kcal und Protein. Keine Namen, keine
  Geräte-IDs, keine IP-Adressen, keine Logs.
- Jeder Tag läuft nach **30 Tagen** automatisch ab, auch wenn ihn nie jemand abholt.
- Die Factory deployt diesen Server nicht. Die Einrichtung machst du einmal selbst
  mit den Schritten unten.

## Einrichtung

Du brauchst Node.js und ein Terminal. Alle Befehle laufen im Ordner `server/`.

1. **Cloudflare-Konto anlegen.** Auf https://dash.cloudflare.com/sign-up ein
   kostenloses Konto erstellen. Der Free-Plan reicht.

2. **Abhängigkeiten installieren.**

   ```sh
   cd server
   npm install
   ```

3. **Bei Cloudflare anmelden.** Öffnet den Browser zum Bestätigen.

   ```sh
   npx wrangler login
   ```

4. **Speicher (KV-Namespace) anlegen.**

   ```sh
   npx wrangler kv namespace create DAYS
   ```

   Die Ausgabe enthält eine `id` (eine lange Zeichenkette aus Buchstaben und
   Zahlen). Öffne `wrangler.toml` und ersetze `HIER_KV_NAMESPACE_ID_EINTRAGEN`
   durch diese id. Die id ist kein Geheimnis.

5. **Zugangs-Token erzeugen und hinterlegen.** Der Token ist das Passwort für den
   Server. Erzeuge einen langen Zufallswert:

   ```sh
   openssl rand -base64 32
   ```

   Dann als Secret bei Cloudflare speichern (der Befehl fragt nach dem Wert, füge
   ihn dort ein):

   ```sh
   npx wrangler secret put TOKEN
   ```

   Den Token **nie** ins Repo schreiben (auch nicht in `wrangler.toml`) und nirgends
   sonst hinschicken. Du brauchst ihn nur noch im iOS-Kurzbefehl und in der App.
   Ohne gesetzten Token antwortet der Server auf alles mit `500`.

6. **Deployen.**

   ```sh
   npx wrangler deploy
   ```

   Am Ende der Ausgabe steht die Adresse des Servers, etwa
   `https://kalisthenik-tracker-server.<dein-name>.workers.dev`. Diese URL brauchst
   du für den Kurzbefehl und die App. Du findest sie auch im Cloudflare-Dashboard
   unter „Workers & Pages“.

Zum lokalen Ausprobieren gibt es `npm run dev` (`wrangler dev`). Den Token dafür
legst du in `server/.dev.vars` ab (`TOKEN=...`); die Datei ist von Git
ausgeschlossen.

## API

Jede Anfrage braucht den Header `Authorization: Bearer <token>`. In den Beispielen
steht `DEIN_TOKEN` als Platzhalter und `https://DEIN-SERVER.workers.dev` für die
Adresse aus Schritt 6. Datumsangaben sind immer `JJJJ-MM-TT`, z. B. `2026-11-24`.

### Tag speichern: `PUT /v1/days/:datum`

Legt die Werte für einen Tag an oder überschreibt sie komplett (kein Zusammenführen:
was nicht mitgeschickt wird, ist danach weg).

Body ist JSON, höchstens 1024 Bytes, mit mindestens einem dieser Felder und keinen
anderen:

| Feld       | Bedeutung        | Erlaubt                     |
| ---------- | ---------------- | --------------------------- |
| `steps`    | Schritte         | ganze Zahl von 0 bis 200000 |
| `kcal`     | Kalorien         | Zahl von 0 bis 20000        |
| `proteinG` | Protein in Gramm | Zahl von 0 bis 1000         |

```sh
curl -X PUT https://DEIN-SERVER.workers.dev/v1/days/2026-11-24 \
  -H "Authorization: Bearer DEIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"steps":8123,"kcal":2010.5,"proteinG":150}'
```

Antwort: `204` (gespeichert) oder `400` (ungültiges Datum oder ungültiger Body).

### Tage abholen: `GET /v1/days?since=JJJJ-MM-TT`

Liefert alle gespeicherten Tage ab `since` (einschließlich), aufsteigend sortiert.
Felder, die nicht gespeichert wurden, fehlen.

```sh
curl "https://DEIN-SERVER.workers.dev/v1/days?since=2026-11-01" \
  -H "Authorization: Bearer DEIN_TOKEN"
```

Antwort: `200` mit

```json
{ "days": [ { "date": "2026-11-24", "steps": 8123, "kcal": 2010.5, "proteinG": 150 } ] }
```

oder `400`, wenn `since` fehlt oder ungültig ist.

### Tage löschen: `DELETE /v1/days?until=JJJJ-MM-TT`

Löscht alle Tage bis einschließlich `until`. Spätere Tage bleiben.

```sh
curl -X DELETE "https://DEIN-SERVER.workers.dev/v1/days?until=2026-11-23" \
  -H "Authorization: Bearer DEIN_TOKEN"
```

Antwort: `204` oder `400`, wenn `until` fehlt oder ungültig ist.

### Statuscodes

| Code  | Bedeutung                                                  |
| ----- | ---------------------------------------------------------- |
| `200` | Daten kommen zurück (GET)                                  |
| `204` | Erledigt (PUT, DELETE)                                     |
| `400` | Ungültiges Datum, ungültiger Parameter oder ungültiger Body |
| `401` | Token fehlt oder ist falsch                                |
| `404` | Unbekannte Adresse                                         |
| `405` | Falsche Methode für diese Adresse                          |
| `500` | Auf dem Server ist kein Token gesetzt (Schritt 5)          |

Fehler kommen als kleines JSON, z. B. `{ "error": "unauthorized" }`.

Browser-Zugriffe (CORS) sind nur von `https://bennji030.github.io` und lokalen
Dev-Ports (`http://localhost:<port>`, `http://127.0.0.1:<port>`) erlaubt. Der
iOS-Kurzbefehl schickt keinen `Origin` und ist davon nicht betroffen.

## Tests

Die Tests liegen in `server/src/*.test.ts` und laufen mit den App-Tests zusammen,
ohne Cloudflare und ohne Netzwerk. Im Hauptordner des Repos:

```sh
npm test
```
