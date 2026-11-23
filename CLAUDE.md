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
  clears anything. Destructive actions need an inline confirm step.
- No `window.alert/confirm/prompt` (they misbehave in iOS standalone mode); use
  the inline confirm pattern from `Workout.tsx`.
- The visible app name is "Calisthenics", but the IndexedDB name `kalisthenik`, the
  backup identifier `kalisthenik-tracker` and the base path `/kalisthenik-tracker/`
  must not be renamed.
- No backend, accounts, analytics or tracking. A network request only when an
  issue asks for one (e.g. a food database lookup), and the app must keep working
  offline without it.
- The factory never deploys by hand, never pushes `main`, and pushes only
  `factory/*` branches.
- Git identity in this repo is `bennji030` with the GitHub no-reply address (set
  in the local git config). Never commit any other email address.

## Stack and layout

Vite + React 19 + TypeScript (strict), Dexie 4 (`dexie-react-hooks` for live
queries), `vite-plugin-pwa` (auto-update service worker), Vitest. No UI or CSS
framework, no router, no chart library.

```
src/db.ts            Dexie schema and types (Exercise, Template/Slot, Session/EntryLog/SetLog, Meta, WeightEntry)
src/progression.ts   suggest(): double progression, rep by rep (see below)
src/progression.test.ts  tests for it (protected)
src/streak.ts       streak(): Trainings in Folge, Wochen Mo–So (flame counter on Home)
src/streak.test.ts  tests for it
src/habits.ts       30-day dot grids and week counts for the Home habit cards
src/habits.test.ts  tests for it
src/monthTiles.ts    month list, per-month counts and summary text for the Home habit subpage
src/monthTiles.test.ts tests for it
src/calendar.ts      week/month day keys, dayStatus() (done/open/missed/none), plannedWeekdays()
src/calendar.test.ts tests for it
src/sessions.ts      history lookup per slot, planTemplate(), startSession()
src/seed.ts          default exercises and the 4 training days (first start only)
src/backup.ts        JSON export (iOS share sheet) and import
src/backupFormat.ts   backup identifier and isBackup() validation (no db import)
src/today.ts        Home cards: duration estimate, next training, 30-day weight trend
src/today.test.ts   tests for it
src/weight.ts        body weight: day keys, 7-entry rolling average, summary, backup validation
src/weight.test.ts   tests for it
src/util.ts          formatting helpers (German number/date format)
src/profile.ts       Profile type (name, gender, height, birth date, body fat), validation, ageOn(); stored in meta key `profile`
src/App.tsx          tab bar (Home, Training, Verlauf, Plan), toast; Settings opens from the gear on Home
src/screens/         Home (overview + weigh-in prompt), Training (week calendar that expands to a month, plus the selected day's card), Workout, HabitMonths (month tiles for Trainings/Weigh-In, opened from the Home cards), History, PlanEditor, Settings (profile + Daten & Backup), BackupSection
src/components/      NumInput, RestTimer, LineChart (hand-written SVG), Weight (Home card, stats), MonthGrid (month calendar, props only, no db), SessionLog (exercise/sets log shared by Verlauf and Training)
src/styles.css       all styles, tokens on :root
factory/             the software factory (see below)
```

Base path is `/kalisthenik-tracker/` (GitHub Pages), set in `vite.config.ts`.

## Domain

- Calendar (Training tab): per day `done` = a finished session started that local day (an unplanned training counts too; running sessions never), `open` = planned weekday, not done, today or later, `missed` = planned weekday, not done, in the past, `none` = anything else.
- Week: Mo Pull A (heavy), Di Push A (heavy), Do Pull B (light), Fr Push B
  (light). Wednesday is a HIIT day, not tracked yet.
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
- Streak (`streak`): weeks Mo–So; a past week counts when finished sessions ≥ number of
  training days (templates), the current week never breaks it; flames = sessions in those weeks.
- Habit cards (Home, bottom): Weigh-In and Trainings, 30 local days as 3×10 dots, week Mo–So,
  x/7 weigh-in days and x/N finished trainings (sessions, not days; N = number of templates);
  tap opens Verlauf → Gewicht / Trainings.
- Goal: fat loss while keeping strength. Body weight with a 7-day average
  exists (one entry per day; entry on Home, history under Verlauf → Gewicht).
  Calories and protein are still planned.

## Design

Dark, calm, iOS-like: system font, cards on `--bg`, one accent `--accent`
(orange), `--ok` green for done, `--warn` amber for missed. Big touch targets
(44px+), numeric keypads (`inputMode`), safe-area insets, tabular numbers.
Use the tokens on `:root` in `styles.css`; no hard-coded colours. The app is
used mid-workout on a phone: fewest taps wins.

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
