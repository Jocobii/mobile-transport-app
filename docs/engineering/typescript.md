# TypeScript standards

## Compiler

- `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax` are on
  (see `packages/config/tsconfig/base.json`). Do not weaken them per package.
- `// @ts-ignore` is forbidden. `// @ts-expect-error` only with a comment explaining why.

## Types

- **No `any`.** Use `unknown` and narrow, or define the type.
- **No non-null assertions (`!`).** Handle the `undefined` case.
- **No `enum`.** Use string literal unions or `as const` objects.
- Prefer `interface` for object shapes that are implemented or extended (ports, models);
  `type` for unions, mapped and utility types.
- Model variants with **discriminated unions** and handle them with exhaustive `switch`:

  ```ts
  function assertNever(value: never): never {
    throw new Error(`Unhandled value: ${String(value)}`);
  }
  ```

- Use `readonly` for data that must not be mutated after creation.
- Branded or clearly named types for ids and units when confusion is likely (`EpochSeconds`, `StopId`).
- Types describing external data (feeds, HTTP bodies, env vars) are validated at runtime at the boundary
  before they become domain types. Never cast external JSON with `as`.

## Modules

- **Named exports only.** Default exports only where a framework requires them
  (Next.js route/page files, Expo Router screens).
- Use `import type` for type-only imports (enforced by `verbatimModuleSyntax`).
- File names in `kebab-case.ts`; React components in `PascalCase.tsx`.
- Each package exposes its public API from `src/index.ts`. No barrel files inside folders unless the
  folder is a public entry point.
- Import other packages by name (`@transit/core`), never by relative path across packages.

## Functions and async

- Prefer pure functions. Pass dependencies (ports) as parameters or constructor arguments.
- `async`/`await` over raw promise chains. Never leave a promise unhandled.
- Parallelize independent I/O with `Promise.all`; use `Promise.allSettled` when partial failure is acceptable
  (e.g. one agency feed failing must not break the others).
- Do not call `Date.now()` or `new Date()` in domain code: inject a `Clock`.

## Errors

- Throw `Error` subclasses with a stable `code` for failures that cross a boundary.
- For expected, recoverable outcomes inside the domain, return explicit results
  (e.g. `{ ok: true, value } | { ok: false, reason }`) instead of throwing.
- Include context in error messages (feed id, URL, stop id), never secrets.

## Style

- Formatting and lint rules are enforced by Biome; do not hand-format against it.
- Prefer `const`; `let` only when reassignment is necessary; never `var`.
- Use optional chaining and nullish coalescing (`??`), not `||`, for defaults of possibly falsy values.
