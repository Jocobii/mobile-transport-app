import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { readUserName, saveUserName } from "@/shared/identity/identity";
import { hideSplash } from "@/shared/splash";
import { WelcomeScreen } from "./WelcomeScreen";

interface IdentityGateProps {
  children: ReactNode;
}

/**
 * Renders `WelcomeScreen` instead of `children` until a display name is stored (EPIC-010).
 * The map, location permission and polling all live under `children`, so none of them start
 * before the person has typed a name. Reads the name synchronously (MMKV) so there is no flash.
 */
export function IdentityGate({ children }: IdentityGateProps) {
  const [hasName, setHasName] = useState(() => readUserName() !== undefined);

  useEffect(() => {
    if (!hasName) hideSplash();
  }, [hasName]);

  if (!hasName) {
    return <WelcomeScreen onSubmit={(name) => setHasName(saveUserName(name))} />;
  }

  return children;
}
