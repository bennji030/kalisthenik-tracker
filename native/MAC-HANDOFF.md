# Übergabe an den Mac

Diese Datei ist für die Claude-Code-Instanz auf dem MacBook, die dort die native
iOS-App baut und testet. Auf dem Laptop, auf dem der Code entstand, gibt es kein
Xcode: alles in `native/ios-src/` ist ungetestet.

## 1. Prompt für Claude Code auf dem Mac

Terminal öffnen, in den Ordner `kalisthenik-tracker` wechseln (falls er noch
fehlt: `native/README.md`, Schritt 2 und 3), `claude` starten und diesen Text
einfügen:

```
Du übernimmst die native iOS-App dieses Repos (kalisthenik-tracker) auf diesem MacBook.
Lies zuerst vollständig: CLAUDE.md, native/MAC-HANDOFF.md und native/README.md.

Ziel: Die Calisthenics-App läuft als native App auf dem iPhone, in dieser Reihenfolge:
1. Teil 1: App-Hülle mit Mitteilung bei Pausenende und Vibration (README Schritte 1 bis 11)
2. Teil 2: Live Activity für die Pause (README Abschnitt 16)
3. Teil 3: Apple Health direkt über HealthKit (README Abschnitt 17)

Arbeite auf dem Branch factory/042-native-app-teil-3. Er enthält alle drei Teile.
Prüfe zuerst mit `git branch --show-current`, dass du darauf bist, und mit
`git config user.email`, dass die no-reply-Adresse aus README Schritt 3 gesetzt ist.

Die Swift-Dateien in native/ios-src/ wurden ohne Mac geschrieben und nie kompiliert.
Deine Hauptaufgabe: sie mit dem Xcode-Build zum Laufen bringen. Wenn Xcode Fehler zeigt,
korrigiere die Dateien in native/ios-src/ (das Xcode-Projekt verweist direkt darauf),
baue erneut, und committe jede Korrektur einzeln auf dem Branch.

Führe mich Schritt für Schritt durch die README. Ich bin keine Entwicklerin: erkläre
jeden Schritt kurz auf Deutsch, bevor du ihn ausführst, und sag mir genau, was ich in
Xcode oder auf dem iPhone anklicken soll. Alles, was im Terminal geht, machst du selbst.
Mach erst mit dem nächsten Teil weiter, wenn die Testliste des vorherigen geklappt hat
(README Schritt 11, 16.10, 17.7).

Regeln, die immer gelten:
- Push nur auf factory/042-native-app-teil-3. Niemals auf main pushen, nichts mergen,
  nichts von Hand deployen. Der Pull Request bleibt ein Entwurf.
- Git-Identität nur repo-lokal: bennji030 mit der no-reply-Adresse aus README Schritt 3.
  Nie eine andere E-Mail-Adresse committen.
- Die Web-App bleibt, wie sie ist. App-Code spricht nur über src/native.ts mit der Hülle,
  kein Import von @capacitor/* unter src/.
- Trainingsdaten wandern nur per Backup-Export und -Import. Nichts löschen, die App auf
  dem iPhone nicht deinstallieren, ohne vorher ein Backup zu exportieren.
- Vor jedem Push: `bash factory/checks.sh` im Hauptordner muss durchlaufen.
- Bestehende Testdateien (src/*.test.ts) nicht ändern, keine neuen npm-Pakete ohne Rückfrage.

Wenn du nicht weiterkommst: schreib den genauen Fehlertext, die Schrittnummer der README
und was du versucht hast als Kommentar in den Pull Request des Branches
(`gh pr comment`) oder in Issue #88.

Fang an mit: Stand prüfen (Xcode installiert? node -v? Branch? Welche README-Schritte
sind schon erledigt?) und sag mir dann, womit wir weitermachen.
```

## 2. Worum es geht

- **Ziel:** die Calisthenics-Web-App zusätzlich als native iPhone-App, in drei
  Teilen:
  - Teil 1 (Issue #79): Capacitor-Hülle, Mitteilung bei Pausenende, Vibration.
  - Teil 2 (Issue #83): Live Activity für die Pause (Sperrbildschirm, Dynamic
    Island).
  - Teil 3 (Issue #88): Apple Health direkt über HealthKit (Schritte, gegessene
    und verbrauchte Kalorien, Protein).
- **Branch:** `factory/042-native-app-teil-3`. Er enthält Teil 1 + 2 + 3. Dazu
  gibt es einen Pull Request als Entwurf. Er wird **nicht gemergt**, bevor der
  Test auf dem Mac geklappt hat (Mergen nach `main` veröffentlicht die Web-App).
- **Reihenfolge:** Teil 1 (`native/README.md`, Schritte 1 bis 11) → Live Activity
  (Abschnitt 16) → Apple Health (Abschnitt 17). Jeder Teil hat eine Testliste;
  erst wenn sie klappt, kommt der nächste.
- **Ungetestet:** Die fünf Swift-Dateien in `native/ios-src/` wurden auf einem
  Linux-Laptop ohne Xcode geschrieben. Sie werden hier zum ersten Mal kompiliert
  und mit dem Xcode-Build nachgebessert. Fehler beim ersten Build sind erwartbar.
  - `MainViewController.swift`: meldet die beiden Plugins an.
  - `RestActivityAttributes.swift`, `RestActivityPlugin.swift`,
    `RestActivityWidget.swift`: Live Activity.
  - `HealthDaysPlugin.swift`: HealthKit (nur lesen).
- **Web-Seite dazu** (getestet, läuft auch ohne die Plugins): `src/native.ts`
  (Brücke), `src/healthKit.ts` (prüft die Antwort des Health-Plugins, rechnet
  verbraucht = Aktiv- + Ruheenergie), `src/healthSync.ts` (Abgleich),
  `src/screens/HealthSection.tsx` (Knopf „Zugriff auf Apple Health erlauben“).
  Das Plugin `HealthDays` muss genau diese Antwort liefern:
  `{ days: [{ date: "YYYY-MM-DD", steps?, kcal?, proteinG?, activeKcal?, basalKcal? }] }`,
  nur diese Schlüssel, Zahlen ≥ 0. Jeder andere Schlüssel macht die ganze
  Antwort ungültig („Ungültige Antwort von Apple Health“).
- **Kostenlose Apple-ID:** HealthKit braucht vermutlich das bezahlte Apple
  Developer Program. Was dann zu tun ist, steht in README 17.8, erste Zeile.

## 3. Regeln aus CLAUDE.md

- Gepusht werden nur `factory/*`-Branches, hier `factory/042-native-app-teil-3`.
  **Niemals `main`** pushen, nichts mergen, nichts von Hand deployen.
- Git-Identität nur für dieses Repo setzen (ohne `--global`): `bennji030` und
  die no-reply-Adresse aus `native/README.md`, Schritt 3. Nie eine andere
  E-Mail-Adresse committen. Vor dem ersten Commit prüfen:

  ```
  git config user.name
  ```

  ```
  git config user.email
  ```

- Die Web-App bleibt unverändert. App-Code spricht nur über `src/native.ts` mit
  der nativen Hülle; im Browser ist dort alles ein No-op. Kein `@capacitor/*`
  unter `src/`.
- Daten wandern nur per Backup: Web-App → „Backup exportieren“, native App →
  „Backup laden“ (README Schritt 10). Die Apple-Health-Einstellungen gehören zum
  Gerät und werden nicht mit übertragen.
- Vor jedem Push im Hauptordner:

  ```
  bash factory/checks.sh
  ```

  Das sind die Tests und der Build der Web-App. Läuft es nicht durch, nicht
  pushen.
- Bestehende Testdateien (`src/*.test.ts`), `factory/checks.sh`,
  `factory/config.json` und `.github/` nicht ändern. Keine neuen npm-Pakete ohne
  Rückfrage beim Besitzer.
- `native/ios/` (das Xcode-Projekt) und `native/www/` sind gitignored: sie
  entstehen auf dem Mac und werden nicht eingecheckt. Was in Xcode von Hand
  eingestellt wird (Targets, Capabilities, `Info.plist`), steht deshalb als
  Anleitung in der README. Ändert sich dort ein Schritt, die README mitkorrigieren.

## 4. Factory auf dem Mac

1. **Werkzeuge:**
   - Xcode aus dem App Store (README Schritt 2).
   - Node.js LTS (22 oder neuer) von https://nodejs.org.
   - `python3` und `git` kommen mit den Xcode Command Line Tools:

     ```
     xcode-select --install
     ```

   - GitHub-Kommandozeile `gh` (https://cli.github.com), danach anmelden:

     ```
     gh auth login
     ```

2. **Pakete:** im Hauptordner `kalisthenik-tracker`:

   ```
   npm install
   ```

   und im Ordner `native`:

   ```
   npm install
   ```

   Die dabei entstehende `native/package-lock.json` einchecken (README Schritt 4).
3. **Job-Zustand fehlt hier, und das ist richtig so.** `factory/jobs/` ist lokal
   und gitignored. Der Zustand der Jobs vom Laptop (Spec, Reviews, Runden) ist
   auf dem Mac nicht vorhanden. Deshalb läuft die native Arbeit hier **ohne**
   Factory: Korrekturen an `native/` werden direkt auf
   `factory/042-native-app-teil-3` committet (kurze Commit-Nachricht, eine Zeile,
   Englisch, Imperativ) und gepusht:

   ```
   git push origin factory/042-native-app-teil-3
   ```

4. **`/factory run`** ist nur für andere, neue Issues mit dem Label `factory`
   gedacht, nicht für diese Übergabe. Nicht starten, solange der Laptop
   gleichzeitig Jobs baut: beide würden dieselben Issues bearbeiten.

## 5. Fehler melden und beheben

1. Fehlertext holen wie in README Schritt 15: in Xcode den Issue-Navigator (⌘5)
   öffnen, Text kopieren; im Terminal die letzten Zeilen kopieren. Laufzeitfehler
   stehen unten in der Xcode-Konsole.
2. Immer dazuschreiben: **welcher Schritt** der README (Nummer, z. B. 16.9 oder
   17.6), welche Datei, welche Xcode- und iOS-Version.
3. Beheben: die Datei in `native/ios-src/` korrigieren (das Xcode-Projekt
   verweist direkt auf diesen Ordner, ein neuer Build nimmt die Änderung sofort),
   erneut ▶, Testliste wiederholen. Dann als eigener Commit auf
   `factory/042-native-app-teil-3`, `bash factory/checks.sh`, pushen.
4. Stimmt ein Schritt der README nicht mit dem überein, was Xcode zeigt: README
   im selben Commit korrigieren.
5. Kommst du nicht weiter oder braucht es eine Entscheidung des Besitzers (z. B.
   bezahltes Entwicklerkonto für HealthKit): als Kommentar in den Pull Request
   des Branches oder in Issue #88 schreiben, mit Fehlertext und Schrittnummer:

   ```
   gh pr comment factory/042-native-app-teil-3 --body "Schritt 17.3: …"
   ```

6. Am Ende kurz im Pull Request festhalten, was getestet ist: welche Testlisten
   (11, 16.10, 17.7) komplett geklappt haben und was offen ist. Gemergt wird erst
   danach, und nicht vom Mac aus.
