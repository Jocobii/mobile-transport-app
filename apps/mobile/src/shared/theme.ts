import { Platform } from "react-native";

export const colors = {
  ink: "#1d1d1b",
  inkSecondary: "#3d3c39",
  muted: "#5f5e5a",
  line: "#e0ded7",
  surface: "#ffffff",
  map: "#e4e2dc",
  highlight: "#1a56db",
} as const;

export type ArrivalStatusTone = "ok" | "attention" | "problem" | "neutral";

/** Status color system: only times, status chips and banners use these (never route badges). */
export const statusColors: Record<ArrivalStatusTone, { fg: string; bg: string }> = {
  ok: { fg: "#1F7A4D", bg: "#E6F2EA" },
  attention: { fg: "#8A5300", bg: "#FCEFD6" },
  problem: { fg: "#A3281C", bg: "#FBE6E3" },
  neutral: { fg: "#55544F", bg: "#EFEEE9" },
};

/** Color of the big time number per status (canceled/skipped are struck gray, scheduled is ink). */
export const statusTimeColors: Record<ArrivalStatusTone, string> = {
  ok: statusColors.ok.fg,
  attention: statusColors.attention.fg,
  problem: "#8A8984",
  neutral: "#1D1D1B",
};

export const radii = {
  badge: 6,
  card: 14,
  panel: 20,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const fontSizes = {
  body: 15,
  title: 20,
  bigTime: 24,
} as const;

/** Platform monospace for times and badges (no font download). */
export const monospaceFont = Platform.select({ ios: "Menlo", default: "monospace" });
