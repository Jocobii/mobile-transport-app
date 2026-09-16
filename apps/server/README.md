# @transit/server

Transit API built with Next.js route handlers, deployed to Vercel.
The server is transport and composition only; see `docs/engineering/server.md`.

## Environment

| Variable | Required | Description |
|---|---|---|
| `API_KEY` | Yes | Clients must send it in the `x-api-key` header. |

Create `apps/server/.env.local` for local development:

```bash
API_KEY=change-me
```

## Scripts

```bash
pnpm --filter @transit/server dev
pnpm --filter @transit/server test
pnpm --filter @transit/server typecheck
```

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/health` | Server status, catalog version and per-agency feed health |
