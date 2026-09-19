import { getTransitService } from "@/composition/transit-service";
import { readServerConfig } from "@/config/server-config";
import { createStopsInAreaHandler } from "@/handlers/stops-in-area-handler";

export const runtime = "nodejs";

export const GET = createStopsInAreaHandler({
  getService: getTransitService,
  readConfig: readServerConfig,
});
