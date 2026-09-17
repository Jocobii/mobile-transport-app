import { readServerConfig } from "@/config/server-config";
import { createRebuildCatalogHandler } from "@/handlers/rebuild-catalog-handler";

export const runtime = "nodejs";

export const GET = createRebuildCatalogHandler({ readConfig: readServerConfig });
