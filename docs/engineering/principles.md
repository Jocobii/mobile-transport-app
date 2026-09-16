# Engineering principles

The goal is code that a new reader understands quickly and that can be tested without
network, clock or device. When principles conflict, prefer **readability and simplicity**.

## SOLID

**S — Single Responsibility.** A module has one reason to change.
- Parsing a feed, normalizing it, merging it and serializing it are four different units.
- Route handlers do transport only; they do not compute arrivals.

**O — Open/Closed.** Extend behavior by adding implementations, not by editing conditionals.
- New agency or source → new configuration or adapter implementing a port.
- Red flag: `switch (agencyId)` or `if (routeId === "436")`.

**L — Liskov Substitution.** Any implementation of a port must honor its contract.
- A `RealtimeProvider` that cannot provide vehicles says so through `capabilities`; it does not throw
  or return fake data.

**I — Interface Segregation.** Small, focused ports.
- Consumers depend only on the methods they use. Split a port before adding optional methods "for later".

**D — Dependency Inversion.** High-level policy depends on abstractions.
- `core` defines `CatalogProvider`, `RealtimeProvider`, `Clock`, `Cache`; adapters implement them;
  the composition root injects them.

## STUPID — patterns to avoid

| Smell | Why it hurts | Do instead |
|---|---|---|
| **S**ingleton / global state | Hidden coupling, untestable, unsafe across serverless instances | Pass dependencies explicitly; wire once in the composition root |
| **T**ight coupling | Changes ripple everywhere | Depend on ports; keep packages behind their public `index.ts` |
| **U**ntestability | Bugs hide; refactors become risky | Inject I/O, clock and randomness; keep logic pure |
| **P**remature optimization | Complexity without evidence | Measure first; optimize the proven bottleneck; document the measurement |
| **I**ndescriptive naming | Readers must decode intent | Names that reveal intent (see Clean Code) |
| **D**uplication | Fixes applied in one place only | Extract shared knowledge (see DRY) |

## DRY — Don't Repeat Yourself

- DRY is about **knowledge**, not identical-looking lines. One business rule has one home.
- Apply the **rule of three**: tolerate a second copy; extract on the third, once the shared concept is clear.
- A wrong abstraction is worse than duplication. Do not merge code that only looks similar but changes for
  different reasons.

## KISS — Keep It Simple

- Choose the simplest design that satisfies the decided requirements.
- Plain functions and data before classes; classes when they hold dependencies or state.
- No clever one-liners that need a comment to be understood.

## YAGNI — You Aren't Gonna Need It

- Do not build features, options, parameters or abstractions for hypothetical needs.
- "Possible" items in the decisions document (favorites, notifications, other agencies) are not built until decided.

## Other principles

- **Functional core, imperative shell.** Domain rules are pure functions (input → output).
  I/O happens at the edges (adapters, route handlers, hooks).
- **Composition over inheritance.** No class hierarchies for behavior reuse.
- **Law of Demeter.** Talk to direct collaborators; avoid `a.b().c().d()` chains across modules.
- **Immutability by default.** Do not mutate inputs; return new values. Use `readonly` in types where it helps.
- **Fail fast at boundaries, degrade gracefully in the product.** Validate external input immediately;
  when a data source fails, fall back (schedule) instead of breaking the screen.
- **Boy Scout rule, scoped.** Leave touched code a bit cleaner, but keep refactors in separate commits.

## Clean Code

### Naming
- Intention-revealing, pronounceable, searchable: `stopTimeUpdates`, not `stu`; `staleAfterSeconds`, not `t`.
- Booleans read as questions: `isLive`, `hasPredictions`.
- Functions are verbs (`normalizeVehicle`), types are nouns (`VehiclePosition`).
- Units in names when not typed: `radiusMeters`, `ttlSeconds`.
- No abbreviations except well-known domain terms (`GTFS`, `RT`, `id`, `url`).

### Functions
- Small and at **one level of abstraction**. If you need "and" to describe it, split it.
- Prefer at most **3 parameters**; beyond that pass an options object.
- **No boolean flag parameters** that switch behavior; write two functions.
- Early returns instead of deep nesting (max ~2 levels).
- No side effects hidden behind names that suggest a query (`getX` must not write).

### Values and data
- No magic numbers or strings: named constants (`DEFAULT_REALTIME_TTL_SECONDS = 20`).
- Make illegal states unrepresentable with discriminated unions.
- Keep configuration (URLs, thresholds, priorities) out of logic.

### Comments
- Code explains *what*; comments explain *why* (constraints, feed quirks, decisions).
- Document every generic feed rule with a short reason and, when relevant, the decision it comes from.
- No commented-out code, no TODOs without context. Delete dead code.

### Errors
- Expected failures (feed down, not found, invalid input) are values or typed errors handled explicitly.
- Unexpected failures (bugs) throw and are logged once at the boundary.
- Never swallow errors silently; never return fake data to hide a failure.

### Files and modules
- One main concept per file. Files stay small (guideline: under ~200 lines; split when it grows).
- A package exposes its public API only through `src/index.ts`. Do not deep-import another package's internals.
- No circular dependencies.

## Code review checklist

- [ ] Can I understand each function without reading its implementation's callers?
- [ ] Can this logic be tested without network, clock or device?
- [ ] Any `if` on a specific agency, route, stop or vehicle? (must be no)
- [ ] Any new global or module-level mutable state? (must be no)
- [ ] Any duplication of a business rule?
- [ ] Anything built "for later"?
- [ ] Names, units and errors are explicit?
