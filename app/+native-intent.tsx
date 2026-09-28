import { safeIncomingPath } from "../utils/deepLink";

/**
 * Expo Router's hook for links arriving from outside the app (and the one the
 * app is launched with). See utils/deepLink.ts for why game routes are refused.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  return safeIncomingPath(path);
}
