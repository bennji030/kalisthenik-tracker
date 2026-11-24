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
- Die Live Activity (Pause auf dem Sperrbildschirm und in der Dynamic Island) ist
  ein eigener, **noch ungetesteter** Zusatz: siehe Abschnitt 16. Erst die
  Schritte 1 bis 11 erledigen.
- Apple Health (Schritte, gegessene und verbrauchte Kalorien, Protein) liest die
  native App direkt aus HealthKit, ohne Server und ohne Kurzbefehl. Auch das ist
  **noch ungetestet**: siehe Abschnitt 17, nach Abschnitt 16.
- Wer mit Claude Code auf dem Mac weitermacht: `native/MAC-HANDOFF.md` lesen.

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
git checkout factory/042-native-app-teil-3
```

Dieser Branch enthält alle drei Teile: die App-Hülle (Schritte 1 bis 11), die
Live Activity (Abschnitt 16) und Apple Health (Abschnitt 17).

Dann die Git-Identität nur für diesen Ordner setzen (ohne `--global`). So
landet bei einem späteren Commit nicht deine private E-Mail-Adresse im
öffentlichen Repo, sondern die anonyme GitHub-Adresse:

```
git config user.name bennji030
```

```
git config user.email 205840391+bennji030@users.noreply.github.com
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

**Sicherheit: Lockfile sichern.** `npm install` legt die Datei
`native/package-lock.json` an. Sie hält die genauen Versionen aller
mitinstallierten Pakete fest, damit spätere Installationen genau denselben Code
bekommen. Diese Datei bitte einchecken (im Ordner `native`):

```
git add package-lock.json
```

```
git commit -m "Add native lockfile"
```

```
git push
```

Klappt `git push` nicht (Anmeldung bei GitHub fehlt), ist das kein Problem für
den Test: einfach weitermachen und im Chat Bescheid geben.

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
2. **Erstes Training öffnen** → gleich beim Öffnen des Trainings (noch vor dem
   ersten Satz) fragt das iPhone, ob Calisthenics Mitteilungen senden darf. Auf
   **Erlauben** tippen. Ohne das kommen keine Pausen-Mitteilungen (siehe
   Schritt 14, falls versehentlich abgelehnt).
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
- Apple Health kommt in der nativen App direkt aus HealthKit und wird in Xcode
  von Hand eingebaut: siehe Abschnitt 17 (**ungetestet**). Den Server und den
  Kurzbefehl der Web-App nutzt die native App nicht. Ohne Abschnitt 17 trägt man
  Schritte und Kalorien in der nativen App von Hand ein.
- Die Live Activity (Pause auf dem Sperrbildschirm) ist **ungetestet** und wird
  in Xcode von Hand eingebaut: siehe Abschnitt 16.

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
| Keine Mitteilung bei Pausenende / Abfrage versehentlich abgelehnt | iPhone → Einstellungen → Mitteilungen → Calisthenics → „Mitteilungen erlauben“ an, „Töne“ an. Steht Calisthenics dort nicht, die App einmal starten und ein Training öffnen, dann noch einmal nachsehen. |
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

## 16. Live Activity (Pause auf dem Sperrbildschirm)

> **Achtung, ungetestet.** Die Swift-Dateien in `native/ios-src/` wurden
> ohne Mac geschrieben. Sie konnten weder kompiliert noch ausprobiert werden.
> Kompiliert und nachgebessert wird erst hier auf dem Mac. Es ist also normal,
> wenn Xcode beim ersten Versuch Fehler zeigt: den Fehlertext wie in Schritt 15
> in den Chat kopieren, dann wird die Datei korrigiert.

Die Live Activity zeigt die laufende Pause mit Countdown auf dem Sperrbildschirm
und in der Dynamic Island, dazu die nächste Übung und den nächsten Satz.

**Voraussetzung:** Die Schritte 1 bis 11 haben geklappt, die App läuft auf dem
iPhone. Das iPhone braucht iOS 17 oder neuer.

### 16.1 Code holen

Im Ordner `kalisthenik-tracker`:

```
git fetch
```

```
git checkout factory/042-native-app-teil-3
```

```
cd native
```

```
npm run sync
```

```
npx cap open ios
```

### 16.2 Widget-Target anlegen

1. In Xcode oben im Menü **File → New → Target…** wählen.
2. Oben **iOS** auswählen, im Suchfeld „Widget“ tippen, **Widget Extension**
   anklicken → **Next**.
3. **Product Name**: `RestWidget`
4. **Team**: dasselbe wie in Schritt 6.
5. Die Haken bei **Include Live Activity**, **Include Control** und **Include
   Configuration App Intent** entfernen (je nach Xcode-Version gibt es nicht
   alle drei).
6. **Embed in Application**: `App`
7. Auf **Finish** klicken.
8. Xcode fragt „Activate “RestWidget” scheme?“ → auf **Cancel** klicken. So bleibt
   oben das Schema **App** ausgewählt.

### 16.3 Erzeugte Dateien löschen

Xcode hat links im Navigator eine neue Gruppe **RestWidget** angelegt.

1. Die Gruppe **RestWidget** aufklappen.
2. Alle Dateien darin, die auf `.swift` enden (z. B. `RestWidget.swift`,
   `RestWidgetBundle.swift`), markieren → Rechtsklick → **Delete** → **Move to
   Trash**.
3. `Info.plist` und `Assets` in der Gruppe **nicht** löschen.

### 16.4 Unsere Dateien hinzufügen

1. Links im Navigator Rechtsklick auf die Gruppe **App** (die mit
   `AppDelegate.swift` darin) → **Add Files to “App”…**
2. Im Dateifenster zum Ordner `kalisthenik-tracker/native/ios-src` gehen und alle
   fünf Dateien markieren (⌘A).
3. Unten im Fenster: **Copy items if needed** muss **aus** sein (je nach
   Xcode-Version heißt die Auswahl „Action“: dann **Reference files in place**
   wählen). So holt ein späteres `git pull` Korrekturen automatisch.
4. Auf **Add** klicken.
5. Jetzt für jede der fünf Dateien die Zugehörigkeit einstellen: Datei links
   anklicken, rechts den File inspector öffnen (⌥⌘1), dort im Abschnitt **Target
   Membership** die Haken genau so setzen:

   | Datei | App | RestWidget |
   | --- | --- | --- |
   | `RestActivityAttributes.swift` | an | an |
   | `RestActivityPlugin.swift` | an | aus |
   | `MainViewController.swift` | an | aus |
   | `RestActivityWidget.swift` | aus | an |
   | `HealthDaysPlugin.swift` | an | aus |

   Fehlt ein Target in der Liste, dort auf `+` klicken und es hinzufügen.

   `HealthDaysPlugin.swift` gehört zu Apple Health (Abschnitt 17). Die Datei muss
   schon jetzt dabei sein, weil `MainViewController.swift` sie anmeldet. Die
   übrigen Einstellungen für Health folgen in Abschnitt 17; bis dahin läuft die
   App ohne Health.

### 16.5 Plugin anmelden

1. Links im Navigator `App` → `App` → `Base.lproj` → `Main.storyboard` anklicken
   (Pfad: `App/App/Base.lproj/Main.storyboard`).
2. In der Liste links neben der Zeichenfläche **Bridge View Controller**
   anklicken.
3. Rechts den Identity inspector öffnen (⌥⌘4).
4. Unter **Custom Class** bei **Class** `MainViewController` eintragen und Enter
   drücken.
5. Bei **Module** `App` auswählen (oder den Haken **Inherit Module From Target**
   setzen).

### 16.6 Live Activities erlauben

1. Links im Navigator `App` → `App` → `Info.plist` anklicken.
2. Mit der Maus über eine Zeile fahren und auf das `+` klicken.
3. Als Schlüssel `NSSupportsLiveActivities` eintippen (Xcode zeigt danach
   „Supports Live Activities“), Typ **Boolean**, Wert **YES**.

### 16.7 iOS-Version einstellen

1. Links ganz oben das Projekt **App** anklicken → unter „Targets“ **App** →
   Reiter **General** → **Minimum Deployments** → iOS auf `17.0` stellen.
2. Unter „Targets“ **RestWidget** anklicken → **General** → **Minimum
   Deployments** → ebenfalls `17.0`.

### 16.8 Widget signieren

1. Unter „Targets“ **RestWidget** → Reiter **Signing & Capabilities**.
2. Haken bei **Automatically manage signing**, bei **Team** dasselbe Team wie in
   Schritt 6.
3. Der **Bundle Identifier** muss mit dem der App anfangen:
   `de.bennji030.calisthenics.RestWidget`. Hast du in Schritt 6 `.benni`
   angehängt, dann `de.bennji030.calisthenics.benni.RestWidget`.

Eine **App Group** ist nicht nötig: alle Daten (Ende der Pause, Übung, Satz)
reisen mit der Live Activity mit.

### 16.9 Starten

1. Oben in der Mitte von Xcode das Schema **App** (nicht RestWidget) und das
   eigene iPhone auswählen.
2. Auf ▶ klicken (oder ⌘R).
3. Auf dem iPhone: Einstellungen → Apps → **Calisthenics** (unter iOS 17 direkt
   Einstellungen → **Calisthenics**) → **Live-Aktivitäten** einschalten (meist
   schon an).

### 16.10 Testliste

Ein Training starten, einen Satz abhaken und Punkt für Punkt prüfen:

1. **iPhone sperren** → auf dem Sperrbildschirm steht der Countdown mit der
   nächsten Übung und „Satz x/y“ des nächsten Satzes.
2. **App nach oben wegwischen (Home)** → in der Dynamic Island läuft der
   Countdown; lange drücken zeigt Übung und Satz.
3. **Zählt ohne die App** → der Countdown läuft weiter, auch wenn das iPhone
   gesperrt ist.
4. **−15 / +15** in der App → der Countdown springt entsprechend.
5. **✕**, „Training beenden“ und „Training verwerfen“ → die Live Activity
   verschwindet.
6. **Pause läuft ab, App ist offen** → etwa 4 Sekunden nach 0:00 verschwindet die
   Live Activity.
7. **Pause läuft ab, iPhone ist gesperrt** → statt des Countdowns steht „Pause
   vorbei“ (das kann ein paar Sekunden dauern). Sie verschwindet, sobald in der
   App die nächste Pause startet oder das Training endet.

### 16.11 Typische Fehler bei der Live Activity

| Symptom | Was tun |
| --- | --- |
| „'main' attribute can only apply to one type in a module“ oder „Invalid redeclaration“ | Die von Xcode erzeugten Swift-Dateien in der Gruppe RestWidget sind noch da. Löschen, siehe 16.3. |
| „Cannot find 'RestActivityAttributes' in scope“ | `RestActivityAttributes.swift` gehört nicht zu beiden Targets. Haken setzen, siehe 16.4, Punkt 5. |
| „Cannot find 'RestActivityPlugin' in scope“ oder „No such module 'Capacitor'“ | Falsche Zugehörigkeit: `RestActivityPlugin.swift` und `MainViewController.swift` nur bei App, nicht bei RestWidget (16.4, Punkt 5). |
| „'Activity' is only available in iOS 16.1 or newer“ (oder ähnlich mit 16.2 / 17.0) | Minimum Deployments für App **und** RestWidget auf 17.0 stellen, siehe 16.7. |
| „Embedded binary's bundle identifier is not prefixed with the parent app's bundle identifier“ | Bundle Identifier von RestWidget anpassen, siehe 16.8, Punkt 3. |
| Die Live Activity erscheint nicht | Der Reihe nach prüfen: iPhone → Einstellungen → Apps → Calisthenics → „Live-Aktivitäten“ an; `NSSupportsLiveActivities` = YES in der `Info.plist` der App (16.6); Custom Class `MainViewController` im Storyboard (16.5); `npm run sync` ausgeführt (16.1). |
| „Unknown class MainViewController in Interface Builder file“ (unten in der Xcode-Konsole), App startet, aber keine Live Activity | Im Storyboard bei **Module** `App` eintragen, siehe 16.5, Punkt 5. Außerdem prüfen, dass `MainViewController.swift` zum Target App gehört. |
| App startet, aber das Widget wird nicht installiert / Xcode meldet, die iOS-Version des iPhones sei zu alt | Das iPhone hat ein älteres iOS als bei Minimum Deployments eingestellt. iPhone aktualisieren (mindestens iOS 17). |
| „Cannot find 'HealthDaysPlugin' in scope“ | `HealthDaysPlugin.swift` fehlt im Projekt oder gehört nicht zum Target App. Hinzufügen und Haken setzen, siehe 16.4. |
| Ein anderer Swift-Fehler in einer der fünf Dateien | Erwartbar, die Dateien sind ungetestet. Fehlertext und Dateiname wie in Schritt 15 in den Chat kopieren. |

## 17. Apple Health (HealthKit)

> **Achtung, ungetestet.** `HealthDaysPlugin.swift` in `native/ios-src/` wurde
> ohne Mac geschrieben. Die Datei konnte weder kompiliert noch ausprobiert werden.
> Kompiliert und nachgebessert wird erst hier auf dem Mac. Es ist also normal,
> wenn Xcode beim ersten Versuch Fehler zeigt: den Fehlertext wie in Schritt 15
> in den Chat kopieren, dann wird die Datei korrigiert.

Die native App liest Schritte, gegessene Kalorien, Protein und verbrauchte
Kalorien (Aktivenergie + Ruheenergie) direkt aus Apple Health. Sie liest nur, sie
schreibt nichts in Health. Server und Kurzbefehl der Web-App braucht sie nicht.

**Voraussetzung:** Abschnitt 16 ist erledigt, die App läuft mit Live Activity auf
dem iPhone. Die Reihenfolge ist: Teil 1 (Schritte 1 bis 11) → Live Activity
(Abschnitt 16) → Apple Health (dieser Abschnitt).

### 17.1 Code holen

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

```
npx cap open ios
```

### 17.2 Datei hinzufügen (nur falls sie fehlt)

Steht `HealthDaysPlugin.swift` in Xcode schon links in der Gruppe **App**, weiter
mit 17.3. Sie fehlt, wenn Abschnitt 16.4 noch mit vier Dateien gemacht wurde.

1. Links im Navigator Rechtsklick auf die Gruppe **App** (die mit
   `AppDelegate.swift` darin) → **Add Files to “App”…**
2. Im Ordner `kalisthenik-tracker/native/ios-src` die Datei
   `HealthDaysPlugin.swift` auswählen.
3. **Copy items if needed** muss **aus** sein (oder bei „Action“ **Reference
   files in place** wählen).
4. Auf **Add** klicken.
5. Datei links anklicken, rechts im File inspector (⌥⌘1) unter **Target
   Membership**: **App** an, **RestWidget** aus.

### 17.3 HealthKit einschalten

1. Links ganz oben das Projekt **App** anklicken → unter „Targets“ **App** →
   Reiter **Signing & Capabilities**.
2. Oben links auf **+ Capability** klicken.
3. „HealthKit“ tippen und **HealthKit** doppelt anklicken.
4. Im neuen Abschnitt **HealthKit** bleiben beide Haken **aus**: kein „Clinical
   Health Records“, kein „Background Delivery“.

Das Target **RestWidget** bekommt **kein** HealthKit.

### 17.4 Erklärtext für die Abfrage eintragen

1. Links im Navigator `App` → `App` → `Info.plist` anklicken.
2. Mit der Maus über eine Zeile fahren und auf das `+` klicken.
3. Als Schlüssel `NSHealthShareUsageDescription` eintippen (Xcode zeigt danach
   „Privacy - Health Share Usage Description“), Typ **String**.
4. Als Wert diesen Text eintragen:

   ```
   Calisthenics liest Schritte, gegessene und verbrauchte Kalorien sowie Protein aus Apple Health und zeigt sie in der App an.
   ```

Ohne diesen Eintrag stürzt die App ab, sobald man den Zugriff erlauben will.

### 17.5 MyFitnessPal schreibt an Health

In der App **MyFitnessPal**: Mehr → Einstellungen → „Apps & Geräte“ → „Health“.
Dort „Nahrungsenergie“ und „Protein“ einschalten, damit MyFitnessPal sie an
Health schreibt.

### 17.6 Starten und Zugriff erlauben

1. In Xcode das Schema **App** und das eigene iPhone auswählen, dann ▶ (⌘R).
2. In der App: Einstellungen (Zahnrad auf Home) → **Apple Health** → **Zugriff
   auf Apple Health erlauben**.
3. iOS zeigt ein Blatt mit den Kategorien. **Alle aktivieren** antippen (Schritte,
   Nahrungsenergie, Protein, Aktivenergie, Ruheenergie), dann **Erlauben**.
4. Unter dem Knopf steht danach „Apple Health verbunden“, darüber „Letzte
   Aktualisierung: …“.

Danach holt die App die Werte von selbst: beim Start und bei jeder Rückkehr in
die App, höchstens einmal pro Minute.

### 17.7 Testliste

1. **Schritte**: Home → „Schritte heute“ zeigt dieselbe Zahl wie die Health-App
   (Entdecken → Aktivität → Schritte, Tagessumme von heute).
2. **Gegessene Kalorien und Protein**: Home → „Kalorien heute“ zeigt die Werte
   aus MyFitnessPal (in der Health-App: Entdecken → Ernährung → Nahrungsenergie
   und Protein).
3. **Verbraucht**: die Zeile „verbraucht … kcal“ auf der Karte „Kalorien heute“
   ist Aktivenergie + Ruheenergie von heute (Health-App: Entdecken → Aktivität).
4. **Bilanz**: daneben steht „Bilanz“ = gegessen minus verbraucht, z. B.
   2.200 − 2.650 = „Bilanz −450“.
5. **Statistik**: Statistik → Ernährung → Karte „Kalorien“ zeigt zusätzlich eine
   graue Linie mit Punkten (verbraucht), im Untertitel steht „Linie: verbraucht“.
6. **Von Hand eingetragen bleibt**: unter „Schritte & Kalorien“ für heute einen
   anderen Kalorienwert eintragen. Die App verlassen, länger als 60 Sekunden
   warten, zurückkehren → der eingetragene Wert steht noch da.
7. **Flugmodus**: Flugmodus einschalten, App neu öffnen → alles funktioniert wie
   vorher.

### 17.8 Typische Fehler bei Apple Health

| Symptom | Was tun |
| --- | --- |
| „Personal development teams … do not support the HealthKit capability“ oder HealthKit lässt sich nicht hinzufügen | Mit einer kostenlosen Apple-ID (Personal Team) erlaubt Apple HealthKit nicht. Zwei Wege: das bezahlte **Apple Developer Program** (99 $ im Jahr) abschließen und dessen Team in Schritt 6 wählen. Oder die Capability HealthKit wieder entfernen (im Reiter Signing & Capabilities auf das `x` am Abschnitt HealthKit klicken): die App läuft dann ganz normal weiter, Schritte und Kalorien trägt man von Hand ein. Die Fehlermeldung dazu steht nur unter Einstellungen → Apple Health. |
| „Zugriff auf Apple Health nicht möglich“ in der App, in der Xcode-Konsole „Missing com.apple.developer.healthkit entitlement“ | Die Capability HealthKit fehlt beim Target App. Hinzufügen, siehe 17.3, dann wieder ▶. |
| App stürzt ab, sobald man „Zugriff auf Apple Health erlauben“ antippt | `NSHealthShareUsageDescription` fehlt in der `Info.plist` der App. Eintragen, siehe 17.4. |
| „Apple Health ist in dieser App-Version nicht eingebaut.“ in der App | Das Plugin ist nicht angemeldet: `HealthDaysPlugin.swift` gehört zum Target App (17.2), Custom Class `MainViewController` im Storyboard (16.5), `npm run sync` ausgeführt (17.1). |
| Alle Werte bleiben leer, obwohl „Apple Health verbunden“ dasteht | Die Freigabe fehlt. iPhone → Health-App → Profilbild oben rechts → **Apps** → **Calisthenics** → alle Kategorien einschalten. Für Kalorien und Protein außerdem die MyFitnessPal-Einstellung prüfen (17.5). iOS verrät der App nicht, ob das Lesen abgelehnt wurde: sie sieht dann einfach keine Werte. |
| Nur „verbraucht“ fehlt | Die Zeile erscheint erst, wenn Health für den Tag Aktivenergie **und** Ruheenergie hat. Beides in der Health-App freigeben (siehe Zeile darüber). |
| „Cannot find 'HealthDaysPlugin' in scope“ | `HealthDaysPlugin.swift` fehlt im Projekt oder gehört nicht zum Target App. Siehe 17.2. |
| „No such module 'Capacitor'“ in `HealthDaysPlugin.swift` | Die Datei gehört fälschlich zum Target RestWidget. Haken dort entfernen, siehe 17.2, Punkt 5. |
| Ein anderer Swift-Fehler in `HealthDaysPlugin.swift` | Erwartbar, die Datei ist ungetestet. Fehlertext und Dateiname wie in Schritt 15 in den Chat kopieren. |
