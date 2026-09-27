import type { ClientIdentity } from "@transit/api-client";
import { readStored, writeStored } from "@/shared/storage/storage";
import { generateInstallId, normalizeUserName, USER_NAME_MAX_LENGTH } from "./identity-rules";

export { generateInstallId, USER_NAME_MAX_LENGTH };

const USER_NAME_KEY = "identity.userName";
const INSTALL_ID_KEY = "identity.installId";

/** The stored display name, or undefined before the welcome screen has ever been completed. */
export function readUserName(): string | undefined {
  return readStored(USER_NAME_KEY);
}

/**
 * Trims the name and stores it. Returns false (and stores nothing) when the trimmed name is
 * empty or longer than `USER_NAME_MAX_LENGTH`.
 */
export function saveUserName(name: string): boolean {
  const normalized = normalizeUserName(name);
  if (normalized === undefined) return false;
  writeStored(USER_NAME_KEY, normalized);
  return true;
}

/** Returns the stored install id, or creates, stores and returns a new one. */
export function getOrCreateInstallId(): string {
  const existing = readStored(INSTALL_ID_KEY);
  if (existing !== undefined) return existing;
  const created = generateInstallId();
  writeStored(INSTALL_ID_KEY, created);
  return created;
}

/** Undefined while no name has been saved yet (the app has not passed the welcome screen). */
export function readClientIdentity(): ClientIdentity | undefined {
  const userName = readUserName();
  if (userName === undefined) return undefined;
  return { userName, installId: getOrCreateInstallId() };
}
