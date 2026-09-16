# Workflow

## Before coding

- Confirm the task matches a decision in the decisions document.
- For non-trivial work, write a short plan (files to touch, ports involved, tests to add) before editing.
- If a choice changes product behavior, scope or architecture, ask instead of deciding.

## While coding

- Small, focused changes. Separate refactors from behavior changes.
- Keep `pnpm typecheck`, `pnpm test` and `pnpm lint` green.
- Do not edit generated or vendored files by hand.

## Commits

- English, **Conventional Commits**: `feat(gtfs): normalize direction from trips.txt when missing`.
- Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `build`, `ci`, `perf`.
- Scope is the package or app: `core`, `gtfs`, `contracts`, `api-client`, `server`, `mobile`, `repo`.
- One logical change per commit.

## Dependencies

- Add a dependency only when it removes real complexity. State the reason in the change description.
- Prefer platform APIs and well-maintained, widely used libraries.
- Add the dependency to the package that uses it, not to the root (except repo-wide tooling).
- Never add a dependency to `@transit/core`'s runtime without an explicit decision.

## Security and privacy

- No secrets in the repository. Use environment variables (`.env.local` is git-ignored).
- The API key header is defined in `@transit/contracts`; never log its value.
- User location is personal data: do not log coordinates or persist them on the server.
- Treat all feed and HTTP input as untrusted; validate at the boundary.

## Performance

- Measure before optimizing (see STUPID → premature optimization). Record the measurement in the change description.
- Known hot paths: decoding large GTFS-RT feeds, catalog loading on cold start, map rendering on mobile.

## Logging

- Structured logs at boundaries (route handlers, adapters), not inside pure domain functions.
- Log feed failures with feed id, status and duration. No personal data.

## Done means

See the Definition of Done in the root `AGENTS.md`.
