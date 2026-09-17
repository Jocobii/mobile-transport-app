import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const PKG_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = path.resolve(PKG_DIR, "..", "..");
const CORE_ENTRY = path.join(REPO_ROOT, "packages/core/src/index.ts");
function withExt(basePath) {
  if (existsSync(basePath) && statSync(basePath).isDirectory()) {
    const idx = `${basePath}/index.ts`;
    return existsSync(idx) ? idx : basePath;
  }
  if (existsSync(basePath)) return basePath;
  if (existsSync(`${basePath}.ts`)) return `${basePath}.ts`;
  if (existsSync(`${basePath}/index.ts`)) return `${basePath}/index.ts`;
  return basePath;
}
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "vitest") return { url: pathToFileURL(path.join(PKG_DIR, ".smoke/vitest-shim.mjs")).href, shortCircuit: true };
  if (specifier === "@transit/core") return { url: pathToFileURL(CORE_ENTRY).href, shortCircuit: true };
  if (specifier.startsWith(".") && context.parentURL) {
    const parentPath = fileURLToPath(context.parentURL);
    const basePath = path.resolve(path.dirname(parentPath), specifier);
    return { url: pathToFileURL(withExt(basePath)).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
