# Calisthenics-Tracker

Offline-Trainings-App (PWA) für Calisthenics: Push/Pull-Plan, automatische Steigerung
(Wiederholung für Wiederholung, dann +Gewicht), Pausentimer, Verlauf mit Diagrammen, Backup als JSON.

Daten liegen nur auf dem Gerät (IndexedDB). Installieren auf dem iPhone: Safari → Teilen → „Zum Home-Bildschirm“.

```bash
npm install
npm run dev     # lokal entwickeln (auch im WLAN erreichbar)
npm test        # Steigerungslogik testen
npm run build
```

Deploy: Push auf `main` → GitHub Actions → GitHub Pages.
