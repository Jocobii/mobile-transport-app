/** Typed server configuration, parsed from environment variables. */
export interface ServerConfig {
  apiKey: string;
  /** Vercel sends `Authorization: Bearer <cronSecret>` to cron routes. Required in production. */
  cronSecret?: string | undefined;
  /** Deploy hook URL called by the cron route. Required in production. */
  catalogDeployHookUrl?: string | undefined;
  /** Catalog location; defaults to `generated/catalog.sqlite` resolved from `process.cwd()`. */
  catalogPath?: string | undefined;
}

export type ServerConfigResult =
  | { ok: true; config: ServerConfig }
  | { ok: false; missing: string[] };

type Environment = Readonly<Record<string, string | undefined>>;

function trimmed(value: string | undefined): string | undefined {
  const result = value?.trim();
  return result ? result : undefined;
}

/** Pure parser so it can be tested without touching `process.env`. */
export function parseServerConfig(env: Environment): ServerConfigResult {
  const apiKey = trimmed(env.API_KEY);
  if (!apiKey) {
    return { ok: false, missing: ["API_KEY"] };
  }
  return {
    ok: true,
    config: {
      apiKey,
      cronSecret: trimmed(env.CRON_SECRET),
      catalogDeployHookUrl: trimmed(env.CATALOG_DEPLOY_HOOK_URL),
      catalogPath: trimmed(env.CATALOG_PATH),
    },
  };
}

export function readServerConfig(): ServerConfigResult {
  return parseServerConfig(process.env);
}
