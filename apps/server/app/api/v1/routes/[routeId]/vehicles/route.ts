import { getTransitService } from "@/composition/transit-service";
import { readServerConfig } from "@/config/server-config";
import { createRouteVehiclesHandler } from "@/handlers/route-vehicles-handler";

export const runtime = "nodejs";

export const GET = createRouteVehiclesHandler({
  getService: getTransitService,
  readConfig: readServerConfig,
});
