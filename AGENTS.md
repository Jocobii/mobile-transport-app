# AGENTS.md — transit-app

Rules for every contributor, human or AI agent. Read this file first, then the
engineering docs that apply to the code you are touching.

## 1. Source of truth

- Product and architecture decisions live in the project decisions document
  ("App de transporte público en tiempo real — Registro de decisiones").
- Implement only what is decided there. Items listed as "open" or "possible" are **not** requirements.
- If a task requires a new product decision, or the code would contradict the document, stop and ask.
  Never invent requirements, endpoints, data fields or feed capabilities.

## 2. Golden rules

1. **English everywhere** in code: names, comments, docs, commits, config, API contracts.
   **The only Spanish text is user-facing labels in the mobile app**, always through i18n files.
2. **Respect the architecture**: ports and adapters with a canonical model. Dependencies point inward.
3. **No logic for a specific route, stop or vehicle.** Everything is generic per standard (GTFS / GTFS-RT)
   or per agency configuration. If it only works for one route, leave it out.
4. **The UI never knows the data source.** It only sees `@transit/contracts`.
5. **Always expose data provenance**: arrivals carry `source: "live" | "scheduled"` and realtime data carries freshness.
6. **Readable and testable first.** Follow `docs/engineering/principles.md`.
7. **Small, focused changes.** One concern per change. No drive-by refactors mixed with features.
8. **Every behavior change ships with tests.** Every bug fix starts with a failing test.
9. **No new dependency without a reason** stated in the change description.
10. **Leave it green**: `pnpm typecheck`, `pnpm test` and `pnpm lint` pass before a change is done.

## 3. Engineering docs

| Doc | Read it when |
|---|---|
| [`docs/engineering/architecture.md`](docs/engineering/architecture.md) | Touching any package boundary, adapter, model, merger or API |
| [`docs/engineering/principles.md`](docs/engineering/principles.md) | Always (SOLID, STUPID, DRY, KISS, YAGNI, Clean Code) |
| [`docs/engineering/typescript.md`](docs/engineering/typescript.md) | Writing any TypeScript |
| [`docs/engineering/testing.md`](docs/engineering/testing.md) | Writing or changing behavior |
| [`docs/engineering/server.md`](docs/engineering/server.md) | Working in `apps/server` |
| [`docs/engineering/mobile.md`](docs/engineering/mobile.md) | Working in `apps/mobile` |
| [`docs/engineering/workflow.md`](docs/engineering/workflow.md) | Committing, adding dependencies, finishing a task |

Packages also have their own `AGENTS.md` with local rules.

## 4. Epics (planned work)

- Planned work lives in [`docs/epics/`](docs/epics/README.md). Each epic is an implementation-ready plan.
- Before starting, read the active epic end to end, then execute its tasks **in order**.
- Implement exactly what the epic specifies (contracts, algorithms, settings, file paths). Do not add scope.
- Mark each task checkbox and the epic status in `docs/epics/README.md` as you progress.
- If the epic is ambiguous, contradicts this file, or hits one of its stop conditions: **stop and ask**.

## 5. Package map and boundaries

```
apps/mobile ──► @transit/api-client ──► @transit/contracts
apps/server ──► @transit/core, @transit/gtfs, @transit/contracts
@transit/gtfs ──► @transit/core
@transit/core ──► (nothing internal)
```

| Package | Responsibility | Must never |
|---|---|---|
| `@transit/core` | Canonical model, ports, TransitService, Merger, domain rules | Import Node, React, Next, fetch, protobuf or any adapter |
| `@transit/gtfs` | GTFS static + GTFS-RT adapters, catalog builder | Contain route-specific logic; be imported by the mobile app |
| `@transit/contracts` | Public API shapes (v1) | Import `core`; contain logic |
| `@transit/api-client` | Typed HTTP client | Contain business rules or UI code |
| `apps/server` | HTTP transport + composition root | Hold domain logic inside route handlers |
| `apps/mobile` | UI, navigation, i18n, device APIs | Import `core` or `gtfs`; hard-code labels |

## 6. Definition of done

- [ ] Matches a decision in the decisions document (or the user explicitly approved it).
- [ ] Respects package boundaries and the golden rules.
- [ ] Tests added or updated; `pnpm typecheck`, `pnpm test`, `pnpm lint` pass.
- [ ] No hard-coded user-facing strings; new labels exist in the Spanish i18n file.
- [ ] Public contracts changed? Versioning rules in `architecture.md` were followed.
- [ ] If behavior or scope changed, the change description says which decision it relates to,
      so the decisions document can be updated.
