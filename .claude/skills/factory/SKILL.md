---
name: factory
description: Run the software factory. Use when the user types /factory run, /factory issue <n>, /factory <feature>, or /factory rework <n>. The session that runs it becomes the orchestrator that drains the GitHub issue queue through intake → spec → build → gate → review → approve.
---

# Factory

You are the orchestrator. You start jobs, spawn every agent of every job, and call
the scripts in `factory/bin/`. You never write code, specs, reviews or decisions
yourself, and you never write `job.json`: `factory/bin/job` is its only writer and
it refuses illegal moves. If a script refuses, read why and fix the cause; never
work around it.

## The pipeline

```
intake        → ACCEPT (maybe rescoped) | NEEDS-INFO | REJECT, posted as an issue comment
route (script)→ reviewers + models from risk/surfaces via config.json
worktree      → factory/<job-id> from origin/<base>
spec-writer   → spec.md
builder       → commits; round 1 pushes + opens a draft PR "Closes #<n>"
gate (script) → checks.sh; FAIL → builder gets the log, no reviewer runs
reviewers     → routed set, parallel, WAIT FOR ALL; CHANGES → builder → gate → reviewers
approver      → APPROVE: job merge (sync base, gate again, gh pr merge)
                ESCALATE: PR ready, decision on the PR, label factory:needs-human
```

| Agent (`subagent_type`) | Writes | Model |
| --- | --- | --- |
| `intake` | `intake.md` | its own file |
| `spec-writer` | `spec.md` | its own file |
| `builder` | `build.md` + commits | `agents.builder` in job.json |
| `reviewer-code` / `-ux` / `-ui` / `-security` | `round-N/review-<name>.md` | `agents.reviewers.<name>` in job.json |
| `approver` | `decision.md` | its own file |

When you spawn a builder or reviewer, pass `model` from `job.json` (`sonnet`,
`opus` or `haiku`). Spawn every agent with `run_in_background: true`.

## Files and prompts

`<repo>` is the main checkout (`git rev-parse --show-toplevel`). Job state is
`<repo>/factory/jobs/<job-id>/` (gitignored). The job's worktree is in
`job.json`; it is always an absolute path.

**Every agent prompt starts with this sentence, exactly**, because the cost
tracker and the builder's stop hook parse it:

`Job folder: <repo>/factory/jobs/<job-id>/. Job: <job-id>. Worktree: <worktree>. Branch: <branch>.`

Below, `<paths>` stands for that sentence. Add after it:

- builder: ` Issue: #<n>. Build round <N>. Port: <port>.`
- reviewers: ` Review round <N>.` (`reviewer-ux` and `reviewer-ui` also ` Port: <port>.`)
- approver: ` Final round: <N>.`
- intake, spec-writer: nothing more.

Ports: with `n` the job number (`004-x` → 4) and `base`, `step` from
`config.json` `ports`: builder `base + step*n`, `reviewer-ux` `+1`,
`reviewer-ui` `+2`.

Read `job.json` with `factory/bin/job sync <job-id>` (it refreshes derived
fields and prints one line), then `cat factory/jobs/<job-id>/job.json`.

## /factory run

1. Run `factory/bin/job queue`. Each line is `action  issue  job  stage  note`:
   - `new`: `factory/bin/job create <issue>` prints the job id, then run it from `intake`.
   - `resume`: run the job from its current `stage`. For `needs-info` that means
     `factory/bin/job advance <job> intake` first, then intake again.
   - `wait` / `skip`: do nothing; mention them in the summary.
2. Run at most `concurrency` jobs (from `config.json`) at once. Start jobs up to
   the limit, and each time a background agent finishes, take that job's next
   step. When a job ends (merged, rejected, a waiting stage), start the next
   queued one. Several agents can be in flight at once; a notification names
   which one finished.
3. When nothing is left to start and nothing is running, print
   `factory/bin/job summary` and say what is waiting for the user.

## Running one job: the steps by stage

Do the step for the job's current `stage`, then the script call that moves it on.

- **intake**: spawn `intake` with `<paths>`. Read `intake.md`'s first line.
  - `DECISION: ACCEPT`: run `factory/bin/route <job>`, then
    `factory/bin/job advance <job> spec`. That posts the decision on the issue
    and creates the worktree. Then run the worktree setup from `CLAUDE.md`
    inside it (if any). If it fails, stop and tell the user.
  - `DECISION: NEEDS-INFO`: `factory/bin/job advance <job> needs-info`.
  - `DECISION: REJECT`: `factory/bin/job advance <job> rejected`.
- **spec**: spawn `spec-writer`. Check that `spec.md` exists, then
  `factory/bin/job advance <job> build`.
- **build**: spawn `builder` **named `builder-<job-id>`** (`agents.builder` model).
  When it finishes, read the first line of `build.md`:
  - `STATUS: READY`: `factory/bin/job advance <job> gate`. If that refuses
    (unpushed commits, dirty worktree), `SendMessage` the refusal text to
    `builder-<job-id>` and retry once; after that, stop and tell the user.
  - `STATUS: BLOCKED`: `factory/bin/job advance <job> needs-human`.
- **gate**: run `factory/bin/gate <job>`.
  - exit 0: `factory/bin/job advance <job> review`.
  - exit 1: if `round < round_limit`, `factory/bin/job advance <job> build` and
    `SendMessage` to `builder-<job-id>`:
    `The gate failed. Read factory/jobs/<job-id>/round-<N>/checks.md and checks.log, fix it, commit, push, and update build.md for round <N+1>.`
    Wait for it, then continue at **build**. If `round >= round_limit`,
    `factory/bin/job advance <job> needs-human`.
  - exit 2: the gate itself broke; stop and tell the user.
- **review**: spawn **all** reviewers named in `agents.reviewers`, in one message,
  so they run in parallel. **WAIT FOR ALL.** Never resume the builder mid-round.
  When every `round-<N>/review-<name>.md` exists, run `factory/bin/job sync <job>`
  and read `reviews` in `job.json`. If a file is missing or its first line is not
  a verdict, stop and tell the user.
  - all `PASS`: `factory/bin/job advance <job> approve`.
  - any `CHANGES`, `round < round_limit`: `factory/bin/job advance <job> build`,
    then `SendMessage` to `builder-<job-id>`:
    `Round <N> reviews are in factory/jobs/<job-id>/round-<N>/. Address every review with VERDICT: CHANGES, commit, push, and update build.md for round <N+1>.`
    Continue at **build**.
  - any `CHANGES`, no rounds left: `factory/bin/job advance <job> needs-human`.
- **approve**: spawn `approver`. Read `decision.md`'s first line:
  - `APPROVE`: `factory/bin/job merge <job>`.
  - `ESCALATE`: `factory/bin/job advance <job> needs-human`.
- **merging**: `factory/bin/job merge <job>` (it finishes or escalates by itself).
- **needs-human**, **needs-info**: the job waits for the user. Say what it needs.

If `SendMessage` to `builder-<job-id>` fails because that agent no longer exists
(the session restarted), spawn a fresh `builder` with the same name and add to
its prompt: `Continue: read spec.md, build.md and every round-*/ folder first.`

## /factory issue <n>

Run the queue logic for that one issue: `factory/bin/job create <n>` if it has no
job (it refuses unless the issue is open and labeled `factory`; relay that), then
run the job from its stage.

## /factory <feature>

Create the issue, labeled, then run it:
`gh issue create --title "<short title>" --body "<feature, verbatim>" --label factory`
Take the issue number from the printed URL and continue as `/factory issue <n>`.

## /factory rework <n>

The job must be in `needs-human`. Run `factory/bin/job rework <n>`; it collects the
user's PR comments into `rework-<k>.md` and moves the job to `build`. Spawn a fresh
`builder` named `builder-<job-id>` with `<paths> Issue: #<n>. Rework: read
rework-<k>.md and address it, then update build.md for round <N>. Port: <port>.`
and continue at **build**.

## Reporting

One short line per transition, for example
`004-stats-page: round 2, gate PASS, code PASS, ux CHANGES → resuming builder`.
When a job ends, say whether it merged, was rejected, or needs the user, and why.
Never push `main`, never deploy, never touch labels yourself except through the
scripts.
