# Testing

## Goals

Tests prove the generic rules work with **real feed shapes** and protect the architecture from regressions.
Tests must be fast, deterministic and runnable offline.

## What to test where

| Layer | Test type | Notes |
|---|---|---|
| `@transit/core` | Unit tests of pure functions, Merger, TransitService with fake ports | Most tests live here |
| `@transit/gtfs` | Adapter tests against fixtures in `test/fixtures` | Real samples from MVTA and Metro Transit, trimmed |
| `@transit/api-client` | Unit tests with a fake `fetch` | Error mapping, headers, URLs |
| `apps/server` | Route handler tests: request → response matches `@transit/contracts` | Adapters replaced by fakes |
| `apps/mobile` | Tests for hooks, formatters and non-trivial view logic | Keep UI tests focused on behavior |

## Rules

- **Tool:** Vitest. Test files are colocated: `foo.ts` → `foo.test.ts`. Fixtures live in `test/fixtures`.
- **Name tests by behavior**, in English: `it("falls back to scheduled arrivals when the realtime feed is stale")`.
- **Arrange / Act / Assert**, one behavior per test.
- **Deterministic:** inject `Clock`; no real network, no real timers, no randomness without a seed.
- **Fakes over mocks.** Implement ports with simple in-memory fakes. Do not mock modules you own;
  do not mock third-party libraries directly — wrap them behind a port and fake the port.
- **Every generic normalization or merge rule has at least one test**, ideally built from a real fixture.
- **Bug fix = failing test first**, then the fix.
- **Test through public APIs** (`src/index.ts` exports), not private helpers.
- Keep fixtures small and anonymized when needed; document where each fixture came from and when it was captured.
- No snapshot tests for large objects; assert the fields that matter.

## Coverage

- No hard coverage percentage. Required: all domain rules, all adapter normalization paths,
  all error and fallback paths.
