import { getTransitService } from "@/composition/transit-service";
import { readServerConfig } from "@/config/server-config";
import { createSearchHandler } from "@/handlers/search-handler";

export const runtime = "nodejs";

export const GET = createSearchHandler({
  getService: getTransitService,
  readConfig: readServerConfig,
});
