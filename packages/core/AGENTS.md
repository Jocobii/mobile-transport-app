# @transit/core

Domain layer. Read `docs/engineering/architecture.md` and `principles.md`.

- Pure TypeScript. **No imports** from Node built-ins, React, Next, Expo, `fetch`, protobuf,
  file system or any other `@transit/*` package.
- Contains: canonical model (`model.ts`), ports (`ports.ts`), TransitService, Merger and domain rules.
- All I/O happens through ports. Time comes from `Clock`; caching through `Cache`.
- No agency-, route- or stop-specific logic.
- Every rule has unit tests with in-memory fakes of the ports.
- Model changes require updating adapters, server mappers and tests in the same change.
