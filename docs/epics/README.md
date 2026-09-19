# Epics

Each epic is a self-contained, implementation-ready plan for one sprint-sized objective.
Epics are written so an AI coding agent (or a person) can execute them **without making product decisions**.

## Index

| ID | Title | Status |
|---|---|---|
| [EPIC-001](EPIC-001-transit-data-api.md) | Transit data API (catalog, realtime, endpoints) | Done |
| [EPIC-002](EPIC-002-mobile-mvp.md) | Mobile MVP (Nearby, Stop, Search) | Done |
| [EPIC-003](EPIC-003-mobile-redesign.md) | Mobile redesign v2 (route-first, vehicle view, colors, gestures) | Done |

Statuses: `Draft` → `Ready` → `In progress` → `Done` (or `Blocked`).

## Conventions

- File name: `EPIC-NNN-short-kebab-title.md`, numbered sequentially. Never renumber.
- Written in English (repository language rule). Only mobile UI labels are in Spanish, inside i18n files.
- Every epic contains, in this order:
  1. Header (status, dependencies, related decisions)
  2. Goal and definition of success
  3. Scope (in / out)
  4. Decisions the epic relies on (with concrete values)
  5. Technical specification (contracts, schemas, algorithms, configuration)
  6. Ordered tasks, each with files, steps, acceptance criteria and tests
  7. Verification (commands and manual checks)
  8. Risks and stop conditions (when the agent must stop and ask)
- Task IDs are `E<epic>-T<nn>` (e.g. `E001-T07`). Tasks are executed in order unless marked parallel.
- While executing, the agent updates the checkbox of each task and the epic status in this index.
- If an epic needs a decision that is not written in it, the agent **stops and asks**. It never invents one.
- When an epic is done, the decisions it introduced must be reflected in the project decisions document.
