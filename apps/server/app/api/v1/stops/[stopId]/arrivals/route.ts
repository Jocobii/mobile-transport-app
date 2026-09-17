import { getTransitService } from "@/composition/transit-service";
import { readServerConfig } from "@/config/server-config";
import { createStopArrivalsHandler } from "@/handlers/stop-arrivals-handler";

export const runtime = "nodejs";

export const GET = createStopArrivalsHandler({
  getService: getTransitService,
  readConfig: readServerConfig,
});
