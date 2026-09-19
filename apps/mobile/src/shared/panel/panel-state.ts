export type Panel =
  | { kind: "nearby" }
  | { kind: "stop"; stopId: string }
  | { kind: "search" }
  | { kind: "route"; routeId: string };

export interface PanelState {
  /** Bottom of the stack is always the Nearby panel. */
  stack: readonly Panel[];
}

export type PanelAction = { type: "push"; panel: Panel } | { type: "back" } | { type: "reset" };

const NEARBY: Panel = { kind: "nearby" };

export const initialPanelState: PanelState = { stack: [NEARBY] };

export function currentPanel(state: PanelState): Panel {
  return state.stack[state.stack.length - 1] ?? NEARBY;
}

export function canGoBack(state: PanelState): boolean {
  return state.stack.length > 1;
}

function isSamePanel(a: Panel, b: Panel): boolean {
  switch (a.kind) {
    case "nearby":
    case "search":
      return a.kind === b.kind;
    case "stop":
      return b.kind === "stop" && a.stopId === b.stopId;
    case "route":
      return b.kind === "route" && a.routeId === b.routeId;
  }
}

export function panelReducer(state: PanelState, action: PanelAction): PanelState {
  switch (action.type) {
    case "push":
      if (isSamePanel(currentPanel(state), action.panel)) return state;
      return { stack: [...state.stack, action.panel] };
    case "back":
      return canGoBack(state) ? { stack: state.stack.slice(0, -1) } : state;
    case "reset":
      return initialPanelState;
  }
}
