/** Typed server configuration, parsed from environment variables. */
export interface ServerConfig {
  apiKey: string;
}

export type ServerConfigResult =
  | { ok: true; config: ServerConfig }
  | { ok: false; missing: string[] };

type Environment = Readonly<Record<string, string | undefined>>;

/** Pure parser so it can be tested without touching `process.env`. */
export function parseServerConfig(env: Environment): ServerConfigResult {
  const apiKey = env.API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, missing: ["API_KEY"] };
  }
  return { ok: true, config: { apiKey } };
}

export function readServerConfig(): ServerConfigResult {
  return parseServerConfig(process.env);
}
