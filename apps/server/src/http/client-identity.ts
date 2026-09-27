import { INSTALL_ID_HEADER, USER_NAME_HEADER } from "@transit/contracts";

/** Sanitized identity headers sent by the mobile client. Both fields are optional. */
export interface ClientIdentity {
  userName?: string | undefined;
  installId?: string | undefined;
}

const USER_NAME_MAX_LENGTH = 30;
const INSTALL_ID_PATTERN = /^[0-9a-f]{16}$/;

/**
 * Reads and sanitizes `x-user-name`/`x-install-id`. Never throws: an undecodable name is
 * reported as `"<invalid>"` (so it still shows up in logs) and a malformed install id is
 * treated as missing.
 */
export function readClientIdentity(request: Request): ClientIdentity {
  return {
    userName: readUserName(request),
    installId: readInstallId(request),
  };
}

function readUserName(request: Request): string | undefined {
  const raw = request.headers.get(USER_NAME_HEADER);
  if (raw === null) return undefined;
  const decoded = decodeUserName(raw);
  const trimmed = decoded.trim();
  if (trimmed.length === 0) return undefined;
  return trimmed.slice(0, USER_NAME_MAX_LENGTH);
}

function decodeUserName(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return "<invalid>";
  }
}

function readInstallId(request: Request): string | undefined {
  const raw = request.headers.get(INSTALL_ID_HEADER);
  if (raw === null) return undefined;
  const candidate = raw.trim().toLowerCase();
  return INSTALL_ID_PATTERN.test(candidate) ? candidate : undefined;
}
