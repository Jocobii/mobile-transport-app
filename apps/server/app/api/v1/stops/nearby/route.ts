import { getTransitService } from "@/composition/transit-service";
import { readServerConfig } from "@/config/server-config";
import { createStopsNearbyHandler } from "@/handlers/stops-nearby-handler";

export const runtime = "nodejs";

export const GET = createStopsNearbyHandler({
  getService: getTransitService,
  readConfig: readServerConfig,
});
