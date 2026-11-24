# Native iOS-App (Capacitor): Checkliste für den Mac

Diese Anleitung führt Schritt für Schritt vom leeren Mac bis zur Calisthenics-App
auf dem iPhone. Jeder Befehl steht in einem eigenen grauen Kasten: kopieren, im
Terminal einfügen, Enter drücken. Wenn etwas schiefgeht, merk dir die
Schrittnummer und schau in Schritt 14 und 15.

Das Terminal findest du unter Programme → Dienstprogramme → Terminal (oder
⌘ Leertaste, „Terminal“ tippen, Enter).

## 1. Was das ist

- Die native App ist ein **Test-Build**: dieselbe App, aber als echte iPhone-App
  mit Mitteilung bei Pausenende (auch bei gesperrtem iPhone) und kurzer Vibration
  beim Abhaken.
- Die Web-App (https://bennji030.github.io/kalisthenik-tracker/) bleibt genau so,
  wie sie ist.
- Der Pull Request wird **nicht gemergt**, bevor der Test auf dem Mac geklappt hat.

## 2. Voraussetzungen

1. **Xcode** aus dem App Store installieren. Das ist ein sehr großer Download
   (viele GB), also früh starten. Danach Xcode einmal öffnen, die Lizenz
   akzeptieren und die iOS-Plattform installieren, wenn Xcode danach fragt.
2. **Node.js LTS** (Version 22 oder neuer, z. B. 24) von https://nodejs.org
   herunterladen und installieren. Danach im Terminal prüfen:

   ```
   node -v
   ```

   Es muss `v22…` oder höher erscheinen.
3. **git** prüfen:

   ```
   git --version
   ```

   Falls macOS anbietet, die Entwicklerwerkzeuge („Command Line Developer Tools“)
   zu installieren: annehmen, warten, danach den Befehl noch einmal ausführen.

## 3. Code holen

```
git clone https://github.com/bennji030/kalisthenik-tracker.git
```

```
cd kalisthenik-tracker
```

```
git checkout factory/039-native-app-teil-1
```

## 4. Pakete installieren

Zuerst im Hauptordner (`kalisthenik-tracker`):

```
npm ci
```

Dann in den Ordner `native` wechseln und dort installieren:

```
cd native
```

```
npm install
```

Fragt die Capacitor-Kommandozeile nach Telemetrie („telemetry“), mit `n`
antworten und Enter drücken.

## 5. Bauen und iOS-Projekt anlegen

Alle Befehle im Ordner `native`:

```
npm run build
```

```
npx cap add ios --packagemanager SPM
```

```
npx cap sync ios
```

```
npx cap open ios
```

Der letzte Befehl öffnet Xcode mit dem Projekt.

### App-Symbol setzen

1. In Xcode links im Projekt-Navigator `App` → `App` → `Assets` anklicken.
2. `AppIcon` auswählen.
3. Rechts im Inspector unter „iOS“ die Größe auf **Single Size** stellen (meist
   schon so), sodass nur ein Feld für 1024 × 1024 da ist.
4. Die Datei `native/resources/AppIcon-1024.png` aus dem Finder in dieses Feld
   ziehen.

## 6. Signieren in Xcode

1. Xcode → Settings (⌘,) → Accounts → unten links `+` → Apple ID → mit deiner
   eigenen Apple-ID anmelden.
2. Links im Navigator ganz oben das Projekt **App** anklicken → in der Mitte unter
   „Targets“ **App** wählen → Reiter **Signing & Capabilities**.
3. Haken bei **Automatically manage signing** setzen.
4. Bei **Team** „<Dein Name> (Personal Team)“ wählen.
5. **Bundle Identifier** ist `de.bennji030.calisthenics`. Meldet Xcode, dass er
   schon vergeben ist, hinten etwas anhängen, z. B.
   `de.bennji030.calisthenics.benni`.

## 7. iPhone verbinden

1. iPhone mit dem Kabel an den Mac anschließen und entsperren.
2. Auf dem iPhone bei „Diesem Computer vertrauen?“ auf **Vertrauen** tippen und
   den Code eingeben.
3. **Entwicklermodus** einschalten: iPhone → Einstellungen → Datenschutz &
   Sicherheit → Entwicklermodus → an → iPhone neu starten → nach dem Neustart
   bestätigen.

   Der Schalter „Entwicklermodus“ erscheint erst, nachdem Xcode das iPhone einmal
   gesehen hat (iPhone angeschlossen und Xcode offen). Falls er fehlt: kurz warten,
   Kabel neu stecken, Einstellungen neu öffnen.

## 8. Starten

1. Oben in der Mitte von Xcode das eigene iPhone als Ziel auswählen.
2. Auf ▶ klicken (oder ⌘R).

Der erste Build dauert ein paar Minuten.

## 9. App vertrauen

Beim ersten Start meldet das iPhone „Nicht vertrauenswürdiger Entwickler“.

Lösung: iPhone → Einstellungen → Allgemein → **VPN & Geräteverwaltung** → deine
Apple-ID antippen → **Vertrauen**. Danach die App noch einmal öffnen.

## 10. Daten umziehen

1. In der installierten **Web-App**: Einstellungen → Daten & Backup →
   „Backup exportieren“ → „In Dateien sichern“.
2. In der **nativen App**: Einstellungen → Daten & Backup → „Backup laden“ → die
   Datei auswählen → „Ersetzen“.

Hinweis: Die Apple-Health-Einstellungen (Server-Adresse, Schlüssel) gehören zum
Gerät und werden nicht mit übertragen.

## 11. Testliste

Ein Training starten und Punkt für Punkt prüfen:

1. **Satz abhaken** → kurze, leichte Vibration.
2. **Erstes Training** → die App fragt, ob sie Mitteilungen senden darf. Erlauben.
3. **iPhone während einer Pause sperren** → bei Pausenende kommt eine Mitteilung
   mit Ton: „Pause vorbei“ / „Weiter mit …“ (Name der nächsten Übung).
4. **App bleibt offen** während der Pause → nur der Piep der App, keine zweite
   Mitteilung, kein doppelter Ton.
5. **−15 / +15** → die Mitteilung kommt entsprechend früher oder später.
   **✕**, „Training beenden“ und „Training verwerfen“ → es kommt keine Mitteilung
   mehr.
6. **Erfolgsbildschirm** nach „Training beenden“ → Erfolgs-Vibration.

## 12. Später aktualisieren

Im Ordner `kalisthenik-tracker`:

```
git pull
```

```
cd native
```

```
npm run sync
```

Dann in Xcode auf ▶ klicken.

## 13. Bekannte Grenzen

- Mit einer kostenlosen Apple-ID läuft die App nach **7 Tagen** ab. Verlängern:
  iPhone per Kabel anschließen und in Xcode wieder ▶ drücken. Die Daten bleiben
  erhalten, solange die App nicht gelöscht wird.
- Apple-Health-Sync funktioniert in der nativen App noch nicht: der Server erlaubt
  nur die Web-Adresse. Das kommt in einem späteren Schritt.
- Die Live Activity (Pause auf dem Sperrbildschirm) kommt in einem eigenen
  Folge-Issue.

## 14. Typische Fehler

| Symptom | Was tun |
| --- | --- |
| Node zu alt (`node -v` zeigt weniger als 22) | Node.js LTS neu von https://nodejs.org installieren (Schritt 2). |
| `npx cap` nicht gefunden / „could not determine executable“ | Du bist im falschen Ordner. In den Ordner `native` wechseln: `cd native` |
| Weißer Bildschirm in der App | `npm run build` und `npx cap sync ios` vergessen. Beides im Ordner `native` ausführen, dann wieder ▶. |
| „No account for team“ oder „Signing requires a development team“ | Signieren einrichten, siehe Schritt 6. |
| „Failed to register bundle identifier“ | Bundle Identifier ändern, z. B. `.benni` anhängen (Schritt 6, Punkt 5). |
| „Developer Mode disabled“ | Entwicklermodus einschalten, siehe Schritt 7. |
| „Untrusted Developer“ / „Nicht vertrauenswürdiger Entwickler“ | App vertrauen, siehe Schritt 9. |
| iOS-Plattform oder iOS-Version nicht installiert | Xcode → Settings → Components → iOS installieren. |
| Gerät gesperrt oder beschäftigt („preparing“, „busy“) | iPhone entsperren und warten, bis Xcode fertig vorbereitet hat. Dann wieder ▶. |
| Mitteilung kommt ohne Ton | Stummschalter am iPhone und Fokus-Modus (z. B. „Nicht stören“) prüfen. In der App muss „Ton bei Pausenende“ an sein. |

## 15. Fehler zurückmelden

So kommt der Fehlertext in den Chat:

1. **In Xcode**: den Issue-Navigator öffnen (⌘5) oder auf den roten Fehler
   klicken. Den Fehlertext markieren und mit ⌘C kopieren (oder Rechtsklick →
   Copy).
2. **Im Terminal**: die letzten Zeilen der Ausgabe mit der Maus markieren und mit
   ⌘C kopieren.
3. Alles in den Chat einfügen (⌘V) und dazuschreiben, **bei welchem Schritt**
   (Nummer) es passiert ist.
