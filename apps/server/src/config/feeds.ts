import type { FeedConfig } from "@transit/core";

/** Array order is the feed priority (first wins for shared stop names and coordinates). */
export const FEEDS: readonly FeedConfig[] = [
  {
    id: "metrotransit",
    name: "Metro Transit",
    timezone: "America/Chicago",
    staticUrl: "https://svc.metrotransit.org/mtgtfs/gtfs.zip",
    vehiclePositionsUrl: "https://svc.metrotransit.org/mtgtfs/vehiclepositions.pb",
    tripUpdatesUrl: "https://svc.metrotransit.org/mtgtfs/tripupdates.pb",
  },
  {
    id: "mvta",
    name: "MVTA",
    timezone: "America/Chicago",
    staticUrl: "https://srv.mvta.com/InfoPoint/GTFS-zip.ashx",
    vehiclePositionsUrl: "https://srv.mvta.com/infoPoint/GTFS-realtime.ashx?&Type=VehiclePosition",
    tripUpdatesUrl: "https://srv.mvta.com/infoPoint/GTFS-realtime.ashx?&Type=TripUpdate",
  },
];
