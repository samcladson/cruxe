import { Platform } from "react-native";
import Purchases, {
  CustomerInfo,
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
  PurchasesOffering,
  PurchasesPackage,
} from "react-native-purchases";
import { reportError } from "./errorReporting";

/**
 * Public SDK keys from the RevenueCat dashboard (Project → API keys).
 * Set in `.env` as EXPO_PUBLIC_* so Metro embeds them at build time.
 */
const API_KEYS = {
  apple: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY || "",
  google: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY || "",
};

let revenueCatReady = false;

let offeringsConfigWarningLogged = false;

function isOfferingsNotConfiguredError(error: unknown): boolean {
  if (error == null || typeof error !== "object") return false;
  const e = error as {
    code?: string;
    message?: string;
    underlyingErrorMessage?: string;
  };
  if (e.code === PURCHASES_ERROR_CODE.CONFIGURATION_ERROR) {
    return true;
  }
  const blob = [e.message, e.underlyingErrorMessage].filter(Boolean).join(" ");
  return (
    /Test Store/i.test(blob) && /no Test Store products/i.test(blob)
  );
}

/**
 * Downgrades the noisy "Test API key + empty offerings" log from ERROR to a single warn.
 * Other SDK logs are forwarded to the console at the same level.
 */
function installRevenueCatLogHandler(): void {
  Purchases.setLogHandler((logLevel, message) => {
    const t = String(message);
    if (
      t.includes("Test Store") &&
      (t.includes("no Test Store products") ||
        (t.includes("ConfigurationError") && /offerings|product/i.test(t)))
    ) {
      if (!offeringsConfigWarningLogged) {
        offeringsConfigWarningLogged = true;
        console.warn(
          "[RevenueCat] Test Store: add products to your current Offering in the RevenueCat dashboard, or ignore until configure: https://rev.cat/how-to-configure-offerings",
        );
      }
      return;
    }
    switch (logLevel) {
      case LOG_LEVEL.VERBOSE:
      case LOG_LEVEL.DEBUG:
        if (__DEV__) {
          console.log("[RevenueCat]", t);
        }
        break;
      case LOG_LEVEL.INFO:
        console.log("[RevenueCat]", t);
        break;
      case LOG_LEVEL.WARN:
        console.warn("[RevenueCat]", t);
        break;
      case LOG_LEVEL.ERROR:
      default:
        console.error("[RevenueCat]", t);
        break;
    }
  });
}

/**
 * Initializes the RevenueCat SDK on app startup.
 * Skips configuration when keys are missing (avoids 401 Invalid API Key spam in dev).
 */
export async function initRevenueCat(): Promise<void> {
  try {
    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);

    if (Platform.OS === "ios") {
      if (!API_KEYS.apple) {
        console.warn(
          "[RevenueCat] Skipping: set EXPO_PUBLIC_REVENUECAT_IOS_API_KEY in .env",
        );
        revenueCatReady = false;
        return;
      }
      Purchases.configure({ apiKey: API_KEYS.apple });
      revenueCatReady = true;
      installRevenueCatLogHandler();
      return;
    }
    if (Platform.OS === "android") {
      if (!API_KEYS.google) {
        console.warn(
          "[RevenueCat] Skipping: set EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY in .env",
        );
        revenueCatReady = false;
        return;
      }
      Purchases.configure({ apiKey: API_KEYS.google });
      revenueCatReady = true;
      installRevenueCatLogHandler();
      return;
    }
    revenueCatReady = false;
  } catch (error) {
    console.error("[RevenueCat] Initialization failed:", error);
    // Every purchase in the app is now impossible; never let this be silent.
    reportError("purchases", error);
    revenueCatReady = false;
  }
}

/**
 * Whether Purchases is configured and safe to call.
 */
export function isRevenueCatReady(): boolean {
  return revenueCatReady;
}

/**
 * Logs the user into RevenueCat using their Supabase UUID.
 */
export async function loginToRevenueCat(userId: string): Promise<void> {
  if (!revenueCatReady) return;
  try {
    await Purchases.logIn(userId);
    console.log(`[RevenueCat] Logged in user: ${userId}`);
  } catch (error) {
    console.error("[RevenueCat] Login failed:", error);
  }
}

/**
 * Resets the RevenueCat customer to an anonymous user (e.g. after sign-out).
 */
export async function logoutRevenueCat(): Promise<void> {
  if (!revenueCatReady) return;
  try {
    await Purchases.logOut();
    console.log("[RevenueCat] Logged out (anonymous customer)");
  } catch (error) {
    console.error("[RevenueCat] Log out failed:", error);
  }
}

/**
 * Fetches the current active Offering (configured in RevenueCat dashboard).
 */
export async function fetchCurrentOffering(): Promise<PurchasesOffering | null> {
  if (!revenueCatReady) return null;
  try {
    const offerings = await Purchases.getOfferings();
    if (offerings.current !== null) {
      return offerings.current;
    }
    return null;
  } catch (error) {
    if (isOfferingsNotConfiguredError(error)) {
      if (!offeringsConfigWarningLogged) {
        offeringsConfigWarningLogged = true;
        console.warn(
          "[RevenueCat] Offerings not configured for Test Store yet. Add products: https://rev.cat/how-to-configure-offerings",
        );
      }
      return null;
    }
    console.error("[RevenueCat] Failed to fetch offerings:", error);
    return null;
  }
}

/**
 * Triggers the native OS purchase sheet for a specific package.
 */
export async function purchasePackage(rcPackage: PurchasesPackage): Promise<{
  customerInfo?: CustomerInfo;
  error?: Error;
  userCancelled: boolean;
}> {
  if (!revenueCatReady) {
    return {
      userCancelled: false,
      error: new Error(
        "IAP is not configured. Set EXPO_PUBLIC_REVENUECAT_*_API_KEY in .env and rebuild.",
      ),
    };
  }
  try {
    const { customerInfo } = await Purchases.purchasePackage(rcPackage);
    return { customerInfo, userCancelled: false };
  } catch (error: any) {
    if (error.userCancelled) {
      return { userCancelled: true };
    }
    // A player who tried to pay and could not — the highest-signal failure
    // in the app. Cancellation above is a normal choice, not an error.
    reportError("purchases", error, { code: String(error?.code ?? "unknown") });
    return { error, userCancelled: false };
  }
}

/**
 * Restores previous purchases (Required by Apple guidelines).
 */
export async function restorePurchases(): Promise<{
  customerInfo?: CustomerInfo;
  error?: Error;
}> {
  if (!revenueCatReady) {
    return {
      error: new Error(
        "IAP is not configured. Set EXPO_PUBLIC_REVENUECAT_*_API_KEY in .env and rebuild.",
      ),
    };
  }
  try {
    const customerInfo = await Purchases.restorePurchases();
    return { customerInfo };
  } catch (error: any) {
    reportError("purchases", error, { op: "restore" });
    return { error };
  }
}
