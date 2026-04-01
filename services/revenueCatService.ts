import { Platform } from "react-native";
import Purchases, {
  CustomerInfo,
  LOG_LEVEL,
  PurchasesOffering,
  PurchasesPackage,
} from "react-native-purchases";

// TODO: Replace with your actual RevenueCat Public API Keys
const API_KEYS = {
  apple: "appl_api_key_here",
  google: "goog_api_key_here",
};

/**
 * Initializes the RevenueCat SDK on app startup.
 * Logs API key warnings if using placeholders.
 */
export async function initRevenueCat(): Promise<void> {
  try {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);

    if (Platform.OS === "ios") {
      Purchases.configure({ apiKey: API_KEYS.apple });
      if (API_KEYS.apple === "appl_api_key_here") {
        console.warn("[RevenueCat] ⚠️ Using placeholder Apple API Key. Purchases will fail.");
      }
    } else if (Platform.OS === "android") {
      Purchases.configure({ apiKey: API_KEYS.google });
      if (API_KEYS.google === "goog_api_key_here") {
        console.warn("[RevenueCat] ⚠️ Using placeholder Google API Key. Purchases will fail.");
      }
    }
  } catch (error) {
    console.error("[RevenueCat] Initialization failed:", error);
  }
}

/**
 * Logs the user into RevenueCat using their Supabase UUID.
 * This guarantees purchase history is tied to their account across devices.
 */
export async function loginToRevenueCat(userId: string): Promise<void> {
  try {
    await Purchases.logIn(userId);
    console.log(`[RevenueCat] Logged in user: ${userId}`);
  } catch (error) {
    console.error("[RevenueCat] Login failed:", error);
  }
}

/**
 * Fetches the current active Offering (configured in RevenueCat dashboard).
 * Usually contains the Starter, Pro, Elite, and Expert coin packs.
 */
export async function fetchCurrentOffering(): Promise<PurchasesOffering | null> {
  try {
    const offerings = await Purchases.getOfferings();
    if (offerings.current !== null) {
      return offerings.current;
    }
    return null;
  } catch (error) {
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
  try {
    const { customerInfo } = await Purchases.purchasePackage(rcPackage);
    return { customerInfo, userCancelled: false };
  } catch (error: any) {
    if (error.userCancelled) {
      return { userCancelled: true };
    }
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
  try {
    const customerInfo = await Purchases.restorePurchases();
    return { customerInfo };
  } catch (error: any) {
    return { error };
  }
}
