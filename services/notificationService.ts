/**
 * notificationService.ts — Local reminders for the daily habit loop.
 *
 * Deliberately LOCAL, not push. Cruxe's two useful reminders — "new puzzles
 * are ready" and "your streak ends tonight" — are both a function of the
 * clock and of state the device already has. Scheduling them on-device means
 * no Firebase project, no FCM credentials, no server, and they still fire
 * with no network.
 *
 * Push would only be needed for messages the server initiates (a friend
 * passed you, a league ended). None of that exists yet, and adding the
 * infrastructure before it does would be building for a feature we haven't
 * designed.
 */
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

/** Stable ids so rescheduling replaces rather than stacks duplicates. */
const DAILY_ID = "cruxe-daily-puzzles";
const STREAK_ID = "cruxe-streak-risk";

const ANDROID_CHANNEL = "cruxe-reminders";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * Asks for notification permission.
 *
 * Call this when the user turns a reminder ON — never on first launch. A
 * permission prompt before the player understands what the app is gets
 * denied, and on Android a denial is effectively permanent.
 */
export async function requestPermission(): Promise<boolean> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
      name: "Daily reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: null,
      vibrationPattern: [0, 200],
      lockscreenVisibility:
        Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  if (!existing.canAskAgain) return false;

  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

export async function hasPermission(): Promise<boolean> {
  const p = await Notifications.getPermissionsAsync();
  return p.granted;
}

/**
 * Schedules the daily "new puzzles" reminder at the given local time.
 * Repeats daily until cancelled.
 */
export async function scheduleDailyReminder(
  hour: number,
  minute: number,
): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(DAILY_ID).catch(
    () => {},
  );

  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_ID,
    content: {
      title: "Today's puzzles are ready",
      body: "A fresh set is waiting, and your free plays have reset.",
      ...(Platform.OS === "android" ? { channelId: ANDROID_CHANNEL } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

/**
 * Schedules a one-off warning that fires tonight if the streak is at risk.
 *
 * Only meaningful when the player has a streak worth protecting and has not
 * played today — the caller decides that, because it needs server state.
 * Rescheduled on every app foreground, so it self-corrects: play today and
 * the next foreground cancels it.
 */
export async function scheduleStreakWarning(
  streak: number,
  hour = 20,
  minute = 0,
): Promise<void> {
  await cancelStreakWarning();

  const when = new Date();
  when.setHours(hour, minute, 0, 0);
  // Already past the warning hour — there is no point firing immediately,
  // and a notification at 3am helps nobody.
  if (when.getTime() <= Date.now()) return;

  await Notifications.scheduleNotificationAsync({
    identifier: STREAK_ID,
    content: {
      title: `Your ${streak}-day streak ends tonight`,
      body: "Solve one puzzle to keep it going.",
      ...(Platform.OS === "android" ? { channelId: ANDROID_CHANNEL } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: when,
    },
  });
}

export async function cancelDailyReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(DAILY_ID).catch(
    () => {},
  );
}

export async function cancelStreakWarning(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(STREAK_ID).catch(
    () => {},
  );
}

export async function cancelAll(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
}
