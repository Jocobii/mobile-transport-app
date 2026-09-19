import { getTransitService } from "@/composition/transit-service";
import { readServerConfig } from "@/config/server-config";
import { createStopTimetableHandler } from "@/handlers/stop-timetable-handler";

export const runtime = "nodejs";

export const GET = createStopTimetableHandler({
  getService: getTransitService,
  readConfig: readServerConfig,
});
