# kalisthenik-tracker

A personal calisthenics tracker: an offline PWA for the owner's iPhone that
replaces a paid training app. The owner describes features in German; the factory
builds them. They want to roughly understand what happens, not write the code, so
in interactive sessions explain each step briefly before doing it.

## Hard rules

- **Merging to `main` deploys.** GitHub Actions builds and publishes to
  https://bennji030.github.io/kalisthenik-tracker/, and the installed app on the
  phone updates itself. Nothing reaches `main` that is not tested.
- **Never lose training data.** All data lives only in IndexedDB on the phone.
  Schema changes add a new Dexie `version(n)` with an upgrade; old versions are
  never edited. Backup export covers every table; import validates before it
  clears anything. The meta keys `health` and `healthStatus` (Apple Health server
  address, key and sync status) are device-local: not exported and kept on import.
  Destructive actions need an inline confirm step.
- No `window.alert/confirm/prompt` (they misbehave in iOS standalone mode); use
  the inline confirm pattern from `Workout.tsx`.
- The visible app name is "Calisthenics", but the IndexedDB name `kalisthenik`, the
  backup identifier `kalisthenik-tracker` and the base path `/kalisthenik-tracker/`
  must not be renamed.
- No backend, accounts, analytics or tracking. A network request only when an
  issue asks for one (e.g. a food database lookup), and the app must keep working
  offline without it.
  Exception (approved by the owner): the self-hosted mini server in `server/` (Cloudflare Worker now, own server later) that only relays daily Apple Health totals (steps, kcal, protein). The app must work fully without it.
- The factory never deploys by hand, never pushes `main`, and pushes only
  `factory/*` branches.
- Git identity in this repo is `bennji030` with the GitHub no-reply address (set
  in the local git config). Never commit any other email address.

## Stack and layout

Vite + React 19 + TypeScript (strict), Dexie 4 (`dexie-react-hooks` for live
queries), `vite-plugin-pwa` (auto-update service worker), Vitest. No UI or CSS
framework, no router, no chart library.

```
src/db.ts            Dexie schema and types (Exercise, Template/Slot, Session/EntryLog/SetLog, Meta, WeightEntry, DayValues with optional `manual` field list), saveDay()
src/progression.ts   suggest(): double progression, rep by rep (see below)
src/progression.test.ts  tests for it (protected)
src/stepper.ts       stepValue(), weightStep(): −/+ buttons of the active set in the workout
src/stepper.test.ts  tests for it
src/streak.ts       streak(): Trainings in Folge, Wochen Mo–So (flame counter on Home)
src/streak.test.ts  tests for it
src/habits.ts       30-day dot grids and week counts for the Home habit cards
src/habits.test.ts  tests for it
src/monthTiles.ts    month list, per-month counts and summary text for the Home habit subpage
src/monthTiles.test.ts tests for it
src/calendar.ts      week/month day keys, dayStatus() (done/open/missed/none/cardio/cardio-open), plannedWeekdays()
src/calendar.test.ts tests for it
src/calendarGesture.ts pure swipe decisions for the Training calendar (axis, edge, settle, shiftWeek; tunable touch thresholds `TOUCH_*`, `TOP_SLACK`)
src/calendarGesture.test.ts tests for it
src/calendarGestureTouch.test.ts tests for the touch variants
src/useCalendarGesture.ts touch wiring (React hook) for those gestures
src/tabSwipe.ts      pure decisions for swiping between tabs (adjacentTab, swipeStep, rubberBand)
src/tabSwipe.test.ts tests for it
src/useTabSwipe.ts   touch wiring (React hook) for tab swiping
src/sessions.ts      history lookup per slot, planTemplate(), startSession()
src/addedExercise.ts exercises added during a workout: DEFAULT_SLOT, addedEntry(), isAdded(), planQuestions(), slotFromEntry(), appendSlot()
src/addedExercise.test.ts tests for it (plus suggest() after a free entry)
src/cardio.ts        cardio day: strength/cardio filters, cardioSummary(), logCardio(), one-time ensureCardioDay() (meta flag `cardioDay`)
src/cardio.test.ts   tests for it
src/entryDay.ts      entering a training for another day: entryNoon(), defaultTemplate(), entryTimes()
src/entryDay.test.ts tests for it
src/muscles.ts       muscle groups (13, German labels), parseMuscles(), defaultMuscles() by name, one-time ensureMuscleDefaults() (meta flag `muscleDefaults`), muscleLoad() weighted by sets
src/muscles.test.ts  tests for it
src/seed.ts          default exercises and the 4 training days (first start only)
src/backup.ts        JSON export (iOS share sheet) and import
src/backupFormat.ts   backup identifier and isBackup() validation, exportMeta()/importMeta() for device-local meta keys (no db import)
src/backupMeta.test.ts tests for the meta helpers
src/stats.ts        Statistik, Training: exerciseGroup() (Pull/Push/Skills/Sonstiges), sessionMetric(), exerciseWindow() (letzte 7), windowChange(), fmtChange()
src/stats.test.ts   tests for it
src/today.ts        Home cards: duration estimate, next training, 30-day weight trend
src/today.test.ts   tests for it
src/weight.ts        body weight: day keys, 7-entry rolling average, summary, backup validation
src/weight.test.ts   tests for it
src/dayValues.ts     steps/kcal/protein per day: validators, mergeDay(), stepsWeek(), goalProgress(), dayTrend(), isDayValuesList(), goals (parseGoals), manualFields()/nextManual()
src/dayValues.test.ts tests for it
src/health.ts        Apple Health sync, pure: config/status parsing, URL/token validation, shouldSync(), parseDaysResponse(), mergeHealth(), yesterdayKey(), runHealthSync() (fetch passed in)
src/health.test.ts   tests for it (plus manualFields/nextManual)
src/healthSync.ts    db + fetch wiring for the sync: syncHealth(force), in-memory throttle and running flag, force-next flag
src/useHealthSync.ts hook: sync once when ready and on every return to the app; useSyncRunning()
src/theme.ts         theme preference (dark/light/system), applyTheme()
src/util.ts          formatting helpers (German number/date format)
src/profile.ts       Profile type (name, gender, height, birth date, body fat), validation, ageOn(); stored in meta key `profile`
src/App.tsx          tab bar (Home, Training, Statistik, Plan), toast; swipe left/right switches tabs (not from the left edge, the calendar or horizontal scrollers; off in workout, subpages, inputs and confirms); Settings opens from the gear on Home
src/screens/         Home (overview + weigh-in prompt; today card with the body graphic of today's muscles; habit cards Weigh-In, Trainings, Schritte heute, Kalorien heute, Gewicht), Training (week calendar that expands to a month, plus the selected day's card; swipe gestures: pull down/up = month/week, swipe left/right = next/previous week or month, not from the left edge, vertical while the calendar top is visible; grab handle below the calendar; finished trainings and cardio entries in the selected day's card can be deleted with an inline confirm), Workout (the active set, first open or last focused, has a −/+ line: reps 1, kg = slot increment or 2,5, seconds 5, never below 0), HabitMonths (month tiles for Trainings/Weigh-In, opened from the Home cards), DayValues (Schritte & Kalorien: entry, 30-day curve, editable list; opened from the Schritte/Kalorien cards), History (Statistik: Training with per-exercise cards grouped Pull/Push/Skills/Sonstiges, Alle Trainings, Ernährung with weight + link to Schritte & Kalorien, Cardio list), PlanEditor, Settings (profile, Darstellung, Apple Health + Daten & Backup), HealthSection (server address, key, shortcut name, Verbindung testen, status, setup guide), BackupSection
src/components/      NumInput, RestTimer, LineChart (hand-written SVG; optional per-point value/date labels), Weight (Home card, stats), MonthGrid (month calendar, props only, no db), SessionLog (exercise/sets log shared by Statistik and Training), CardioCheck (check off a cardio day: optional minutes and note, shared by Home and Training), BodyMap (front/back body SVG with trained muscle groups, props only)
src/styles.css       all styles, tokens on :root
factory/             the software factory (see below)
server/              standalone Cloudflare Worker relaying daily Health totals (own package.json with wrangler; not part of the app build; tests in server/src/*.test.ts run with the root npm test; setup in server/README.md)
```

Base path is `/kalisthenik-tracker/` (GitHub Pages), set in `vite.config.ts`.

## Domain

- Calendar (Training tab): per day `done` = a finished session started that local day (an unplanned training counts too; running sessions never), `open` = planned weekday, not done, today or later, `missed` = planned weekday, not done, in the past, `none` = anything else. Strength days win over cardio: `cardio` = only cardio done that day, `cardio-open` = only cardio planned, today or later.
- Week: Mo Pull A (heavy), Di Push A (heavy), Do Pull B (light), Fr Push B
  (light). Wednesday is the cardio day: a template with `kind: 'cardio'` and no
  slots, checked off with one tap (optional minutes and note). A cardio entry is a
  finished `Session` with `kind: 'cardio'` and no entries. Cardio counts extra: it
  is not part of the weekly goal, the flames, the 7-day line or the month count,
  and has its own colour (`--cardio`). Templates and sessions without `kind` are
  strength. The Cardio day is added once (also on fresh installs) behind the meta
  flag `cardioDay`; importing a backup sets the flag, so a deleted Cardio day stays
  deleted.
- Exercise types: `weighted` (reps + added kg), `reps` (bodyweight), `hold`
  (seconds). A slot is an exercise inside a day with its own sets, rep range,
  increment, start weight, rest time and a `progression` flag. Skill work
  (Muscle-up, Handstand) runs with `progression: false` ("frei"): values from last
  time are prefilled, nothing is judged. The owner picks the skill exercises.
- Progression (`suggest`): last session hit every target → +1 rep on the first
  set with the fewest reps (4,4,4,4 → 5,4,4,4 → 5,5,4,4 …); all sets at the top
  of the range → +increment kg and back to the bottom; missed → same target; 3
  misses in a row at the same weight → about −10 % and rebuild. History is per
  slot within its training day.
- Exercises can be added during a workout ("+ Übung": pick one or create a new one;
  a same-named exercise is reused). An added exercise is an entry whose `slotId` is
  not in the template: free, 3 empty sets, removable (inline confirm once a set is
  done). After saving, the app asks per added exercise with a done set that is not
  already in that training day whether to add it to the end of the day with the
  default slot values (`DEFAULT_SLOT`; weighted start weight from today's first done
  set). The new slot reuses the entry's slot id, so the workout counts as last time;
  `suggest()` treats a free last entry on a progression slot as "Erstes Mal".
- Streak (`streak`): weeks Mo–So; a past week counts when finished sessions ≥ number of
  training days (templates), the current week never breaks it; flames = sessions in those weeks.
- Habit cards (Home, bottom): Weigh-In and Trainings, 30 local days as 3×10 dots, week Mo–So,
  x/7 weigh-in days and x/N finished trainings (sessions, not days; N = number of templates);
  tap opens Statistik → Ernährung / Alle Trainings.
- Trainings can be entered for any day (Training tab → "Training für diesen Tag
  eintragen"). They are stored at 12:00 of that day plus the real duration (meta
  `entryDay` holds the chosen day while the workout runs); the newest date counts
  as "last time" for progression, also when it lies in the future.
- Schritte & Kalorien: table `days`, one row per local day (YYYY-MM-DD) with
  optional `steps`/`kcal`/`proteinG`, `source` `manual`|`health` and `updatedAt`.
  Apple Health sync: the meta key `health` holds `{ url, token, shortcut }`, `healthStatus`
  holds `{ lastSync, error }`. The app fetches the last 30 days from the server once
  after start and on every return to the app (at most once per 60 s, in memory;
  "Jetzt aktualisieren" on the steps card runs the iOS shortcut and forces the next
  fetch). Manual protection is per field: the optional `manual` list on a row names
  the hand-entered fields, which Health never overwrites (legacy manual rows without
  a list count as all-manual). After saving, the app deletes the server's days until
  yesterday. Sync errors show only in Settings → Apple Health, never on Home. Goals live in the meta key `goals` (defaults 2200 kcal /
  160 g protein / 8000 steps, set under Einstellungen → Profil). Entry, curve and
  history with edit/delete are on the DayValues subpage, opened from the Home cards
  "Schritte heute" and "Kalorien heute".
- Muscles: exercises have an optional `muscles` list (13 groups in `muscles.ts`,
  read only through `parseMuscles()`). Defaults by exercise name are written once
  behind the meta flag `muscleDefaults` (import does not set it). The Home "today"
  card shows a front/back body graphic with today's planned or finished strength
  muscles, stronger the more sets; no graphic on rest/cardio days or while a session
  runs. Editing muscles comes later with the plan editor.
- Goal: fat loss while keeping strength. Body weight with a 7-day average
  exists (one entry per day; entry on Home, history under Statistik → Ernährung).
  Calories, protein and steps can be entered by hand or come from Apple Health.

## Design

Dark, calm, iOS-like: system font, cards on `--bg`, one accent `--accent`
(orange), `--ok` green for done, `--warn` amber for missed. Big touch targets
(44px+), numeric keypads (`inputMode`), safe-area insets, tabular numbers.
Use the tokens on `:root` in `styles.css`; no hard-coded colours. The app is
used mid-workout on a phone: fewest taps wins.

There is a light token set under `:root[data-theme="light"]`; every colour token
must be defined in both sets, and no colour literals live outside them. The theme
preference is the `meta` key `theme` (`dark`/`light`/`system`), cached in
localStorage for the pre-paint script in `index.html`. Text on a `*-soft`
background uses `--on-accent-soft` / `--on-cardio-soft`.

The layout is phone-first with one breakpoint at `min-width: 700px` (nav on top,
grids, max width 1200px); lists of cards are wrapped in `.cards` to become a grid
on wide screens. Hover styles only inside `(hover: hover) and (pointer: fine)`.

## Design skills

`.claude/skills/` holds four skills by Emil Kowalski (MIT). Agents that build or
review UI read the matching files directly:

- `emil-design-eng/SKILL.md`: any visible change or interaction.
- `review-animations/SKILL.md` and `STANDARDS.md`: a change adds or alters motion.
- `mobile-native/SKILL.md`: touch, viewport or phone behaviour (always relevant here).
- `break-ui/CATALOG.md`: a change renders data; try realistic worst cases (long
  exercise names, 0 sessions, 200 sessions, odd weights like 1,25).

They are guidance, not rules of this repo. The hard rules and the design section
win: no animation or toast libraries. Ignore each skill's "Initial Response" and
output format; factory agents keep their own format and their own bar for
`CHANGES`, so a skill's advice alone goes under Notes.

## Commands

- Worktree setup (fresh factory worktree): `ln -s <repo>/node_modules node_modules`
  where `<repo>` is the main checkout. If a job adds a dependency, that needs
  `npm install` by a human; the approver escalates new dependencies anyway.
- Dev server on a port: `npx vite --port <port> --strictPort`, then open
  `http://localhost:<port>/kalisthenik-tracker/`. Data lives in the browser's
  IndexedDB per origin, so each port starts empty and seeds the default plan.
- Validation, the same script the gate runs: `bash factory/checks.sh`
  (`npm test` + `npm run build`, which includes `tsc`). New behaviour in logic
  files gets tests in a new `src/*.test.ts` file; existing test files are
  protected and must not be edited.

## Conventions

- Small components, plain names, comments only where the code is not obvious.
- UI text in German, code and identifiers in English.
- German number format in the UI (`1,25 kg`), via helpers in `util.ts`.
- Commit messages: short, one line, imperative.

## Software factory

`/factory run` builds every open GitHub issue labeled `factory` through
intake → spec → build → gate → review → approve, one PR per issue. State is in
`factory/jobs/` (gitignored); `factory/bin/job` is its only writer. Checks:
`factory/checks.sh`. Worktrees: `../kalisthenik-tracker-factory/<job-id>`.
Dashboard: `cd factory && python3 -m http.server 8000`, then open
http://localhost:8000/dashboard.html.
