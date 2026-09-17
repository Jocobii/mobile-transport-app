import type { NextConfig } from "next";

// Workspace packages (@transit/*) are transpiled automatically by the App Router.
const nextConfig: NextConfig = {
  // Trace the generated catalog into every API route's output bundle so it's present
  // in the deployed function (EPIC-001 §13, E001-T16). Paths are relative to this
  // project's root (apps/server) per the Next.js 16 docs' monorepo note.
  outputFileTracingIncludes: {
    "/api/**": ["./generated/catalog.sqlite"],
  },
};

export default nextConfig;
