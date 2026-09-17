import { getTransitService } from "@/composition/transit-service";
import { readServerConfig } from "@/config/server-config";
import { createRouteDetailHandler } from "@/handlers/route-detail-handler";

export const runtime = "nodejs";

export const GET = createRouteDetailHandler({
  getService: getTransitService,
  readConfig: readServerConfig,
});
