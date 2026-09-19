import { isFilterFull, isRouteSelected, type RouteFilter } from "@/features/map/route-filter";

/** How one search result row behaves in the route picker. */
export interface PickerRowState {
  selected: boolean;
  /** Unselected rows cannot be added once the filter is full; selected ones can always be removed. */
  disabled: boolean;
}

export function pickerRowState(routeId: string, filter: RouteFilter): PickerRowState {
  const selected = isRouteSelected(filter, routeId);
  return { selected, disabled: !selected && isFilterFull(filter) };
}
