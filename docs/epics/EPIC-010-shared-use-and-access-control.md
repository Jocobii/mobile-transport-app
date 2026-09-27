# EPIC-010 — Shared use: user name, install id and access control

| Field | Value |
|---|---|
| Status | In progress |
| Depends on | **EPIC-009 Done** (this epic adds fields to the `http.request` log line and a new log event through the `Logger` port). |
| Related decisions | User, 2026-09-27: share the app with ~5 friends. A **free-text name** on first launch (no sign-up, no password; fake names are fine — nothing personal is stored). Identification is only for **logs** (no database). The owner must be able to **stop the spread**: cut one install or everyone except himself. Google Cloud key restriction + budget alert is done by hand in the console (checklist in §7). |
| Read first | `AGENTS.md`, `docs/engineering/architecture.md`, `principles.md`, `server.md`, `mobile.md`, `typescript.md`, `testing.md`, `workflow.md`, `docs/engineering/logging.md` (from EPIC-009) |

---

## 1. Goal

When the app is shared, the owner can see **live in Vercel Logs who is making each request**
(the name the person typed plus an anonymous install id), and can **block one install** or
**close the app to everyone except an allow-list** by changing an environment variable — without
shipping a new APK.

### Definition of success
1. First launch asks "¿Cómo te llamas?" once; the name is stored on the phone and never asked again.
2. Every API request carries the name and an anonymous install id; every `http.request` log line shows
   `user` and `installId`.
3. `BLOCKED_INSTALL_IDS=<id>` in Vercel (plus redeploy) makes that phone get `403 access_denied`;
   the app shows a clear Spanish message instead of the generic error.
4. `ALLOWED_INSTALL_IDS=<id1>,<id2>` makes every other install get `403 access_denied`.
5. Nothing else is stored: no database, no location next to the name, no device identifiers.
6. `pnpm verify` passes.

---

## 2. Scope

### In scope
- `@transit/contracts`: two header constants, one new error code.
- `@transit/api-client`: optional identity headers.
- `apps/server`: access config, access check in `handleApiRequest`, log fields.
- `apps/mobile`: identity storage, first-launch name screen, access-denied message, i18n.
- Release signing with a personal keystore (so the Google key restriction in §7 means something).
- Docs updates.

### Out of scope (do not implement)
- Registration, passwords, per-user codes, OAuth, any account system.
- Any database or external store (Upstash, Neon, Vercel KV…). Logs only.
- Editing the name after first launch (possible future story).
- Showing the install id inside the app.
- Rate limiting per user.
- iOS distribution changes.
- Any change to response bodies of successful requests.

---

## 3. Decisions this epic relies on

**Decided by the user (2026-09-27)**

| Topic | Value |
|---|---|
| Identity | Free-text name typed by the person. No verification. |
| Storage | Logs only (Vercel stdout, ~1 h retention on Hobby, viewed live). |
| Control | Block a single install; close to everyone except an allow-list. No new APK needed. |
| Google Cloud | Owner restricts the Maps key and sets a budget alert by hand (§7). |

**Proposed by Claude (architect/PO); change before executing if you disagree**

| Topic | Value |
|---|---|
| Headers | `x-user-name` (value = `encodeURIComponent(name)`, so accents/emoji are safe in HTTP headers) and `x-install-id`. |
| Name rules | Trimmed, 1–30 characters (counted after trim). Server decodes, trims, truncates to 30; an undecodable value is logged as `"<invalid>"`. |
| Install id | 16 lowercase hex chars generated once on first launch, stored in MMKV. Not a device identifier; reinstalling the app creates a new one. `Math.random` is acceptable (it is an anonymous label, not a secret) — no new dependency. Server accepts only `/^[0-9a-f]{16}$/`; anything else is treated as missing. |
| Missing identity | Requests **without** identity headers are still allowed (old builds, `prewarm` on the very first launch) unless `ALLOWED_INSTALL_IDS` is set, which rejects them. Logged with `user`/`installId` absent. |
| Env vars | `BLOCKED_INSTALL_IDS` and `ALLOWED_INSTALL_IDS`: optional, comma-separated, whitespace-tolerant, empty = unset. Allow-list wins over nothing: when set, only listed ids pass; block-list is always applied. |
| Order of checks | config → API key (`401`) → access (`403`) → handler. |
| Status/code | `403` with the new code `access_denied` for both block-list and allow-list rejections. Log `reason: "blocked" \| "not_allowed"`. |
| Applying changes | Vercel env var changes apply on the next deployment: owner edits the var and clicks **Redeploy** (no new APK). Documented, not automated. |
| Mobile gate | A gate in the root layout renders the name screen instead of the app while no name is stored. The map, location permission and polling do not start until a name exists. |

---

## 4. Technical specification

### 4.1 Contracts (`packages/contracts/src/index.ts`)

```ts
/** Header with the user-typed display name, URI-encoded. */
export const USER_NAME_HEADER = "x-user-name";
/** Header with the anonymous per-install id (16 lowercase hex chars). */
export const INSTALL_ID_HEADER = "x-install-id";
```

`ApiErrorCode` gains `"access_denied"` (additive; existing codes unchanged — follow the versioning
rules in `architecture.md`: an added error code is non-breaking).

### 4.2 API client (`packages/api-client/src/index.ts`)

```ts
export interface ClientIdentity { userName: string; installId: string }

export interface ApiClientOptions {
  baseUrl: string;
  apiKey?: string;
  /** Read on every request so a name saved after startup is picked up. */
  getIdentity?: () => ClientIdentity | undefined;
  fetchImpl?: typeof fetch;
}
```

In `get()`: when `getIdentity()` returns a value, set `USER_NAME_HEADER` to
`encodeURIComponent(userName)` and `INSTALL_ID_HEADER` to `installId`. No other change.

### 4.3 Server config (`apps/server/src/config/server-config.ts`)

`ServerConfig` gains:

```ts
/** Install ids that are always rejected. Empty when unset. */
blockedInstallIds: ReadonlySet<string>;
/** When defined, only these install ids are accepted. Undefined when unset or empty. */
allowedInstallIds?: ReadonlySet<string> | undefined;
```

Parsed by a pure `parseIdList(value: string | undefined): Set<string>` (split on `,`, trim, drop
empties, lowercase). Neither variable is required.

### 4.4 Identity and access (`apps/server/src/http/client-identity.ts`, `access.ts`)

```ts
export interface ClientIdentity { userName?: string; installId?: string }
/** Reads and sanitizes the identity headers. Never throws. */
export function readClientIdentity(request: Request): ClientIdentity;

export type AccessDecision = { ok: true } | { ok: false; reason: "blocked" | "not_allowed" };
/** Pure. */
export function checkAccess(identity: ClientIdentity, config: ServerConfig): AccessDecision;
```

`checkAccess`: if `installId` ∈ blocked → `blocked`; else if `allowedInstallIds` is defined and
`installId` is missing or ∉ allowed → `not_allowed`; else ok.

`handleApiRequest` (after the API key check): read identity, check access; on reject return
`errorResponse("access_denied", "Access to this app has been disabled.")` with status `403`
(add `access_denied: 403` to `STATUS_BY_ERROR_CODE` in `responses.ts`).

### 4.5 Logging (extends EPIC-009 §4.3)

| Event | Level | Change |
|---|---|---|
| `http.request` | by status | Add optional `user` and `installId`. Present for **every** request that sent them, including 401/403. |
| `http.access_denied` | warn | New. Fields: `requestId?`, `path`, `reason`, `user?`, `installId?`. |
| `http.unhandled_error`, `http.catalog_unavailable` | — | Add optional `user`, `installId`. |

Privacy rule stays: no query string, no coordinates. The name is logged **only** as the `user` field.
`docs/engineering/logging.md` event table and privacy section updated accordingly.

### 4.6 Mobile

**Identity storage** — `apps/mobile/src/shared/identity/identity.ts` (on top of `shared/storage`):

```ts
export const USER_NAME_MAX_LENGTH = 30;
export function readUserName(): string | undefined;
/** Trims; returns false (and stores nothing) when empty or too long. */
export function saveUserName(name: string): boolean;
/** Returns the stored id or creates, stores and returns a new one. */
export function getOrCreateInstallId(): string;
export function readClientIdentity(): ClientIdentity | undefined; // undefined while no name
```

Storage keys: `identity.userName`, `identity.installId`. `generateInstallId(random = Math.random)`
is exported for tests.

**Client** — `apps/mobile/src/api/client.ts` passes `getIdentity: readClientIdentity`.

**Gate** — `apps/mobile/src/features/identity/IdentityGate.tsx` wraps `<Stack />` in
`src/app/_layout.tsx`. It reads the name synchronously (MMKV) so there is no flash; without a name it
renders `WelcomeScreen` and calls `hideSplash()`.

**WelcomeScreen** — `apps/mobile/src/features/identity/WelcomeScreen.tsx`: title, one-line
explanation, a text input (autofocus, `maxLength` 30, `autoCapitalize="words"`, return key submits),
a "Continuar" button disabled while the trimmed value is empty. On submit: `saveUserName`,
`getOrCreateInstallId`, then the gate re-renders the app.

**Access denied** — `PanelStatus` (and any other place that shows `common.error`) shows
`errors.accessDenied` when the error is an `ApiError` with `code === "access_denied"`. Implement as a
pure helper `errorMessageKey(error: unknown): "common.error" | "errors.accessDenied"` in
`src/shared/format/` (tested) — do not duplicate the check. Polling keeps its current behavior.

**i18n (`es.json`)**

```json
"welcome": {
  "title": "¡Hola!",
  "message": "¿Cómo te llamas? Solo lo uso para saber quién usa la app. Puedes poner el nombre que quieras.",
  "placeholder": "Tu nombre",
  "continue": "Continuar"
},
"errors": {
  "accessDenied": "El acceso a esta app está desactivado. Pregúntale a quien te la compartió."
}
```

### 4.7 Release signing (`apps/mobile`)

Today the release build is signed with the React Native template `debug.keystore`, whose SHA-1 is
public and identical in every new project — restricting the Google key to it protects nothing, and a
later change of keystore forces friends to uninstall.

- `android/` is generated (CNG, git-ignored), so signing is added with a local config plugin
  `apps/mobile/plugins/with-release-signing.js` registered in `app.config.ts`. It adds a `release`
  signing config that reads `TRANSIT_UPLOAD_STORE_FILE`, `TRANSIT_UPLOAD_STORE_PASSWORD`,
  `TRANSIT_UPLOAD_KEY_ALIAS`, `TRANSIT_UPLOAD_KEY_PASSWORD` from Gradle properties
  (`~/.gradle/gradle.properties`, never committed), and uses it for `buildTypes.release` **only when
  those properties exist** (falls back to debug otherwise, so CI/dev keep working).
- The keystore file lives outside the repo (e.g. `~/keys/transit-release.keystore`). `*.keystore`
  is already git-ignored.
- No new dependency (`@expo/config-plugins` ships with Expo).

---

## 5. Tasks (stories)

- [x] **E010-T01 — Contracts and API client.** contracts + api-client.
  - §4.1, §4.2.
  - Tests (api-client): with `getIdentity` → both headers sent, name `"José 🚌"` is URI-encoded; without
    it → no identity headers; `getIdentity` is called per request (value change picked up).

- [x] **E010-T02 — Server access control.** Depends on T01, EPIC-009. server.
  - §4.3, §4.4, `responses.ts` mapping for `access_denied` → 403.
  - Tests: `parseIdList` (unset, empty, spaces, duplicates, uppercase); `readClientIdentity` (valid,
    encoded accents, bad encoding → `"<invalid>"`, >30 chars truncated, bad install id ignored);
    `checkAccess` (no lists; blocked; allow-list with listed/unlisted/missing id; id in both lists →
    blocked); `handleApiRequest`: 401 still wins over 403; blocked → 403 `access_denied` and the
    handler is not called; allowed → handler runs.

- [ ] **E010-T03 — Log fields.** Depends on T02. server.
  - §4.5.
  - Tests: `http.request` includes `user`/`installId` when sent, omits them when not;
    `http.access_denied` with `reason`; no line contains the query string or coordinates.
  - **Blocked on EPIC-009** (not yet Done: no `Logger` port, no `http.request` line to extend).
    As an interim measure, `handleApiRequest` (`apps/server/src/http/handle-api-request.ts`) logs
    a plain `console.warn(JSON.stringify({ event: "http.access_denied", path, reason, user?,
    installId? }))` on every access-control rejection, matching this codebase's existing ad-hoc
    `console.*` style. It is marked `// TODO(EPIC-009): replace with Logger port +
    http.access_denied event once EPIC-009 lands` and does not touch any generic per-request
    logging, since EPIC-009 has not built that yet.

- [x] **E010-T04 — Mobile identity and welcome screen.** Depends on T01. mobile.
  - §4.6 (identity module, client wiring, `IdentityGate`, `WelcomeScreen`, i18n).
  - Tests: `saveUserName` (trim, empty, 30 vs 31 chars); `generateInstallId` with an injected random
    (16 hex); `getOrCreateInstallId` is stable across calls; `readClientIdentity` undefined without a
    name.
  - Manual: fresh install → welcome screen, no location prompt until "Continuar"; relaunch → straight
    to the map.

- [x] **E010-T05 — Access-denied message.** Depends on T01, T04. mobile.
  - `errorMessageKey` + use it where `common.error` is rendered.
  - Tests: `ApiError(403, "access_denied")` → `errors.accessDenied`; other errors → `common.error`.

- [x] **E010-T06 — Release signing.** Independent. mobile.
  - §4.7. Document keystore creation in `apps/mobile/README.md`:
    `keytool -genkeypair -v -keystore ~/keys/transit-release.keystore -alias transit -keyalg RSA -keysize 2048 -validity 10000`
    and the four Gradle properties.
  - Manual: `pnpm --filter @transit/mobile release:android` with the properties set; confirm the APK signature
    with `keytool -printcert -jarfile <apk>` shows the new SHA-1 (not `5E:8F:16:06:…`).

- [ ] **E010-T07 — Close.** `pnpm verify`; update `docs/engineering/logging.md` (§4.5), `server.md`
  ("Configuration and environment": both env vars, redeploy note; access check step in the
  `handleApiRequest` list), `mobile.md` (identity gate, identity headers), `architecture.md` (contracts:
  new headers and error code); epic header and index `Done`; add the decisions to the project
  decisions document.
  - **Blocked on EPIC-009**: `docs/engineering/logging.md` does not exist yet (EPIC-009 creates
    it) and T03's real implementation isn't done, so this close step can't run yet. T01, T02, T04,
    T05, T06 are done and green (`pnpm verify`); the epic stays `In progress`, not `Done`, until
    EPIC-009 lands and T03/T07 are completed for real.

---

## 6. Verification
- `pnpm verify` on the Mac.
- Local: `curl` with/without `x-user-name`/`x-install-id`; set `BLOCKED_INSTALL_IDS` in `.env.local`
  → 403 `access_denied` and an `http.access_denied` line.
- After deploy: open the app, Vercel → Logs → live mode; filter by `user` and see your name on each
  `http.request` line. Copy your `installId` from there.
- Kill switch drill: set `ALLOWED_INSTALL_IDS=<your id>` in Vercel → Redeploy → a second phone shows
  "El acceso a esta app está desactivado…", yours keeps working. Remove it and redeploy.

## 7. Owner checklist — Google Cloud (manual, not code)
1. After T06, get the **new** release SHA-1: `keytool -list -v -keystore ~/keys/transit-release.keystore -alias transit`.
2. Console → APIs & Services → Credentials → the Android Maps key:
   - Application restrictions: **Android apps** → package `dev.gamoro.transit` + the release SHA-1
     (add the debug SHA-1 as a second entry only if you still run debug builds against this key).
   - API restrictions: **Restrict key** → only **Maps SDK for Android**.
3. Billing → Budgets & alerts → new budget, amount **1 USD**, alerts at 50 % / 100 % by email.
4. Optional: APIs & Services → enabled APIs → disable anything the app does not use.

## 8. Risks and stop conditions
- **EPIC-009 not done:** stop; this epic needs the `Logger` port.
- **Header encoding:** if React Native `fetch` rejects or alters the encoded header, stop and ask
  (do not switch to a query parameter — query strings are never logged).
- **Next.js/Expo APIs:** the config plugin and route wiring must follow the versions installed (read
  `node_modules/next/dist/docs/` and Expo's config-plugin docs in `node_modules`). If the plugin cannot
  be written without a new dependency, stop and ask.
- **Existing tests change expected responses:** wrong — only 403 for rejected ids is new. Stop.
- **Scope creep:** no database, no user list endpoint, no admin screen. Stop and ask if one seems needed.
- Never run `git` commands in the user's folder (project rule).
