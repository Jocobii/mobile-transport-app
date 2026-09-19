import { useCallback, useReducer } from "react";
import {
  canGoBack,
  currentPanel,
  initialPanelState,
  type Panel,
  panelReducer,
} from "./panel-state";

export function usePanelState() {
  const [state, dispatch] = useReducer(panelReducer, initialPanelState);

  const push = useCallback((panel: Panel) => dispatch({ type: "push", panel }), []);
  const back = useCallback(() => dispatch({ type: "back" }), []);
  const reset = useCallback(() => dispatch({ type: "reset" }), []);

  return { panel: currentPanel(state), canGoBack: canGoBack(state), push, back, reset };
}
