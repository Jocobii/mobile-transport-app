import { describe, expect, it } from "vitest";
import {
  canGoBack,
  currentPanel,
  initialPanelState,
  type PanelAction,
  type PanelState,
  panelReducer,
} from "./panel-state";

const ROUTE = {
  id: "mvta:436",
  feedId: "mvta",
  shortName: "436",
  longName: "46th St Station-MSP-Viking Lakes-Eagan",
};

function run(actions: PanelAction[], from: PanelState = initialPanelState): PanelState {
  return actions.reduce(panelReducer, from);
}

describe("panelReducer", () => {
  it("starts on the nearby panel with nothing to go back to", () => {
    expect(currentPanel(initialPanelState)).toEqual({ kind: "nearby" });
    expect(canGoBack(initialPanelState)).toBe(false);
  });

  it("pushes panels on top of the stack", () => {
    const state = run([
      { type: "push", panel: { kind: "search" } },
      { type: "push", panel: { kind: "stop", stopId: "56939" } },
    ]);

    expect(currentPanel(state)).toEqual({ kind: "stop", stopId: "56939" });
    expect(canGoBack(state)).toBe(true);
  });

  it("walks back through the stack one panel at a time", () => {
    const state = run([
      { type: "push", panel: { kind: "search" } },
      { type: "push", panel: { kind: "route", route: ROUTE } },
      { type: "back" },
    ]);

    expect(currentPanel(state)).toEqual({ kind: "search" });
  });

  it("stays on nearby when going back from the bottom of the stack", () => {
    expect(run([{ type: "back" }])).toBe(initialPanelState);
  });

  it("ignores pushing the panel that is already on top", () => {
    const once = run([{ type: "push", panel: { kind: "stop", stopId: "1" } }]);
    const twice = panelReducer(once, { type: "push", panel: { kind: "stop", stopId: "1" } });

    expect(twice).toBe(once);
  });

  it("pushes a stop panel for a different stop", () => {
    const state = run([
      { type: "push", panel: { kind: "stop", stopId: "1" } },
      { type: "push", panel: { kind: "stop", stopId: "2" } },
    ]);

    expect(state.stack).toHaveLength(3);
  });

  it("resets to the nearby panel from any depth", () => {
    const state = run([
      { type: "push", panel: { kind: "search" } },
      { type: "push", panel: { kind: "route", route: ROUTE } },
      { type: "reset" },
    ]);

    expect(state).toEqual(initialPanelState);
  });
});

describe("panelReducer vehicle and trip panels", () => {
  const VEHICLE = {
    kind: "vehicle",
    vehicleId: "mvta:v1",
    stopId: "56939",
    routeId: "mvta:436",
    directionId: 1,
  } as const;

  it("opens the vehicle view over the current panel and goes back to it", () => {
    const state = run([{ type: "push", panel: VEHICLE }, { type: "back" }]);
    expect(currentPanel(state)).toEqual({ kind: "nearby" });
  });

  it("ignores pushing the same vehicle for the same stop again", () => {
    const once = run([{ type: "push", panel: VEHICLE }]);
    expect(panelReducer(once, { type: "push", panel: { ...VEHICLE } })).toBe(once);
  });

  it("pushes the same vehicle when the stop differs", () => {
    const state = run([
      { type: "push", panel: VEHICLE },
      { type: "push", panel: { ...VEHICLE, stopId: "1" } },
    ]);
    expect(state.stack).toHaveLength(3);
  });

  it("treats a trip panel as the same only for the same trip and stop", () => {
    const arrival = {
      tripId: "mvta:t1",
      routeId: "mvta:436",
      routeShortName: "436",
      directionId: 1,
      headsign: "Eagan",
      time: 1000,
      source: "scheduled",
      status: "normal",
    } as const;
    const once = run([{ type: "push", panel: { kind: "trip", arrival, stopId: "1" } }]);
    expect(
      panelReducer(once, { type: "push", panel: { kind: "trip", arrival, stopId: "1" } }),
    ).toBe(once);
    expect(
      panelReducer(once, { type: "push", panel: { kind: "trip", arrival, stopId: "2" } }).stack,
    ).toHaveLength(3);
  });
});
