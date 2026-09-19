import type { MapStyleElement } from "react-native-maps";

/** Google Maps style: hides points of interest and transit; roads and neighborhood labels stay. */
export const MAP_STYLE: MapStyleElement[] = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];
