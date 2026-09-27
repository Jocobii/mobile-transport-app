/**
 * Pure identity rules, kept free of any storage import: `identity.ts` (the storage-backed
 * wrapper) transitively pulls in `react-native-mmkv` → `react-native`, which the mobile
 * package's Vitest setup (plain Node, no RN renderer) cannot parse. Splitting the pure rules
 * out is what keeps them unit-testable; see `docs/engineering/testing.md`.
 */

export const USER_NAME_MAX_LENGTH = 30;

/** Trims the name; returns undefined when the trimmed result is empty or too long. */
export function normalizeUserName(name: string): string | undefined {
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > USER_NAME_MAX_LENGTH) {
    return undefined;
  }
  return trimmed;
}

const INSTALL_ID_LENGTH = 16;
const HEX_CHARS = "0123456789abcdef";

/** 16 lowercase hex characters. Not a device identifier: `random` is injectable for tests. */
export function generateInstallId(random: () => number = Math.random): string {
  let id = "";
  for (let i = 0; i < INSTALL_ID_LENGTH; i++) {
    id += HEX_CHARS[Math.floor(random() * HEX_CHARS.length)];
  }
  return id;
}
