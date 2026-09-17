import { getTransitService } from "@/composition/transit-service";
import { readServerConfig } from "@/config/server-config";
import { createVehicleDetailHandler } from "@/handlers/vehicle-detail-handler";

export const runtime = "nodejs";

export const GET = createVehicleDetailHandler({
  getService: getTransitService,
  readConfig: readServerConfig,
});
