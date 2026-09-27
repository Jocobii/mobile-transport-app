import type { ServerConfig } from "@/config/server-config";
import type { ClientIdentity } from "./client-identity";

export type AccessDecision = { ok: true } | { ok: false; reason: "blocked" | "not_allowed" };

/**
 * Pure. Block-list is always applied; when an allow-list is configured, a missing or
 * unlisted install id is rejected too (an id in both lists is rejected as blocked).
 */
export function checkAccess(identity: ClientIdentity, config: ServerConfig): AccessDecision {
  const { installId } = identity;
  if (installId !== undefined && config.blockedInstallIds.has(installId)) {
    return { ok: false, reason: "blocked" };
  }
  if (config.allowedInstallIds !== undefined) {
    if (installId === undefined || !config.allowedInstallIds.has(installId)) {
      return { ok: false, reason: "not_allowed" };
    }
  }
  return { ok: true };
}
