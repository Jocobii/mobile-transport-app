import { Platform } from "react-native";

export const colors = {
  ink: "#1d1d1b",
  inkSecondary: "#3d3c39",
  muted: "#5f5e5a",
  line: "#e0ded7",
  surface: "#ffffff",
  map: "#e4e2dc",
  live: "#1f7a4d",
  problem: "#a3281c",
  highlight: "#1a56db",
} as const;

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
