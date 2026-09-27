/** Typed server configuration, parsed from environment variables. */
export interface ServerConfig {
  apiKey: string;
  /** Vercel sends `Authorization: Bearer <cronSecret>` to cron routes. Required in production. */
  cronSecret?: string | undefined;
  /** Deploy hook URL called by the cron route. Required in production. */
  catalogDeployHookUrl?: string | undefined;
  /** Catalog location; defaults to `generated/catalog.sqlite` resolved from `process.cwd()`. */
  catalogPath?: string | undefined;
  /** Install ids that are always rejected. Empty when unset. */
  blockedInstallIds: ReadonlySet<string>;
  /** When defined, only these install ids are accepted. Undefined when unset or empty. */
  allowedInstallIds?: ReadonlySet<string> | undefined;
}

export type ServerConfigResult =
  | { ok: true; config: ServerConfig }
  | { ok: false; missing: string[] };

type Environment = Readonly<Record<string, string | undefined>>;

function trimmed(value: string | undefined): string | undefined {
  const result = value?.trim();
  return result ? result : undefined;
}

/** Comma-separated, whitespace-tolerant, lowercased. Empty or unset yields an empty set. */
export function parseIdList(value: string | undefined): Set<string> {
  if (!value) return new Set();
  const ids = value
    .split(",")
    .map((id) => id.trim().toLowerCase())
    .filter((id) => id.length > 0);
  return new Set(ids);
}

/** Pure parser so it can be tested without touching `process.env`. */
export function parseServerConfig(env: Environment): ServerConfigResult {
  const apiKey = trimmed(env.API_KEY);
  if (!apiKey) {
    return { ok: false, missing: ["API_KEY"] };
  }
  const allowedInstallIds = parseIdList(env.ALLOWED_INSTALL_IDS);
  return {
    ok: true,
    config: {
      apiKey,
      cronSecret: trimmed(env.CRON_SECRET),
      catalogDeployHookUrl: trimmed(env.CATALOG_DEPLOY_HOOK_URL),
      catalogPath: trimmed(env.CATALOG_PATH),
      blockedInstallIds: parseIdList(env.BLOCKED_INSTALL_IDS),
      allowedInstallIds: allowedInstallIds.size > 0 ? allowedInstallIds : undefined,
    },
  };
}

export function readServerConfig(): ServerConfigResult {
  return parseServerConfig(process.env);
}
