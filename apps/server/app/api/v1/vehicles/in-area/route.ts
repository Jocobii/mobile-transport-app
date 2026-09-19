import { getTransitService } from "@/composition/transit-service";
import { readServerConfig } from "@/config/server-config";
import { createVehiclesInAreaHandler } from "@/handlers/vehicles-in-area-handler";

export const runtime = "nodejs";

export const GET = createVehiclesInAreaHandler({
  getService: getTransitService,
  readConfig: readServerConfig,
});
