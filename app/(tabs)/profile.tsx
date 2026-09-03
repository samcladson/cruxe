import { useFocusEffect } from "@react-navigation/native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import React, { useCallback, useState } from "react";
import { 
  Alert,
  Platform,
  ScrollView, 
  StyleSheet, 
  Switch, 
  Text, 
  TouchableOpacity,
  View,
  ActivityIndicator
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { router } from "expo-router";
import { CATEGORIES } from "../../constants/categories";
import { theme } from "../../constants/theme"; // Keep theme imported as it's used elsewhere
import { useSettingsStore } from "../../stores/settingsStore";
import { useUserStore } from "../../stores/userStore";

import { formatCompactNumber } from "../../utils/formatNumber";
import {
  deleteAccountAndReset,
  getLinkedProviders,
  linkAppleAccount,
  linkGoogleAccount,
  signOutAndStartNewAnonSession,
} from "../../services/authService";
import * as Haptics from "expo-haptics";
import {
  cancelAll,
  cancelDailyReminder,
  cancelStreakWarning,
  requestPermission,
  scheduleDailyReminder,
} from "../../services/notificationService";

export default function ProfileScreen() {
  const profile = useUserStore((state) => state.profile);
  const settings = useSettingsStore();
  /**
   * Which account action is currently running, or null.
   *
   * This used to be one shared `isLinking` boolean, which meant every row
   * that showed a spinner showed it at once: deleting an account lit up the
   * Google sign-in and Sign out rows too. A row should only spin for its own
   * work, while still being disabled by anyone else's.
   */
  const [busyAction, setBusyAction] = useState<
    "apple" | "google" | "signOut" | "delete" | null
  >(null);
  const isBusy = busyAction !== null;
  const [linked, setLinked] = useState({
    hasGoogle: false,
    hasApple: false,
  });

  const refreshLinked = useCallback(async () => {
    const l = await getLinkedProviders();
    setLinked(l);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshLinked();
    }, [refreshLinked]),
  );

  const triggerHaptic = () => {
    if (settings.hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleAppleLink = async () => {
    triggerHaptic();
    setBusyAction("apple");
    let error: Error | null = null;
    let user: Awaited<ReturnType<typeof linkAppleAccount>>["user"];
    let signedIntoExisting = false;
    try {
      ({ error, user, signedIntoExisting = false } = await linkAppleAccount());
    } catch (e: any) {
      error = e instanceof Error ? e : new Error(String(e));
    } finally {
      // In a finally so a throw cannot leave the row spinning forever.
      setBusyAction(null);
    }
    if (error) {
      Alert.alert("Link Failed", error.message);
    } else if (user) {
      void refreshLinked();
      Alert.alert(
        signedIntoExisting ? "Welcome back" : "Success",
        signedIntoExisting
          ? "Signed into your existing Apple account. Your progress has been restored."
          : "Your account is now securely linked to Apple!",
      );
    }
  };

  const handleGoogleLink = async () => {
    triggerHaptic();
    setBusyAction("google");
    let error: Error | null = null;
    let user: Awaited<ReturnType<typeof linkGoogleAccount>>["user"];
    let signedIntoExisting = false;
    try {
      ({ error, user, signedIntoExisting = false } = await linkGoogleAccount());
    } catch (e: any) {
      error = e instanceof Error ? e : new Error(String(e));
    } finally {
      setBusyAction(null);
    }
    if (error) {
      Alert.alert("Link Failed", error.message);
    } else if (user) {
      void refreshLinked();
      Alert.alert(
        signedIntoExisting ? "Welcome back" : "Success",
        signedIntoExisting
          ? "Signed into your existing Google account. Your progress has been restored."
          : "Your account is now securely linked to Google!",
      );
    }
  };

  const handleSignOut = () => {
    triggerHaptic();
    Alert.alert(
      "Sign out",
      "Your local progress on this device will reset and you’ll go back to the start screen. You can sign in again there, or carry on as a guest.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setBusyAction("signOut");
              let error: string | null = "Sign out failed";
              try {
                ({ error } = await signOutAndStartNewAnonSession());
                // The streak that warning referred to is no longer this
                // session's. Onboarding flags stay - signing out is not the
                // same as starting over.
                await cancelStreakWarning();
              } catch (e: any) {
                error = e?.message ?? "Sign out failed";
              } finally {
                // In a finally so no failure above can strand the screen on
                // a spinner the user cannot dismiss.
                setBusyAction(null);
              }

              if (error) {
                Alert.alert("Sign out failed", error);
              } else {
                void refreshLinked();
                // The start screen is the sign-in screen now. It reads
                // hasCompletedOnboarding, which signing out deliberately
                // leaves set, so this returns to the tabs rather than
                // replaying the warm-up.
                router.replace("/(auth)/welcome");
              }
            })();
          },
        },
      ],
    );
  };

  /**
   * Permission is requested here, at the moment the user asks for a
   * reminder — never on first launch. A prompt before the player knows what
   * the app is gets denied, and on Android a denial is close to permanent.
   */
  const handleDailyReminder = async (enabled: boolean) => {
    triggerHaptic();
    if (!enabled) {
      settings.setDailyReminder(false);
      await cancelDailyReminder();
      return;
    }
    const granted = await requestPermission();
    if (!granted) {
      Alert.alert(
        "Notifications are off",
        "Turn them on for Cruxe in your device settings to get reminders.",
      );
      return;
    }
    settings.setDailyReminder(true);
    await scheduleDailyReminder(settings.dailyReminderHour, 0);
  };

  const handleStreakWarning = async (enabled: boolean) => {
    triggerHaptic();
    if (!enabled) {
      settings.setStreakWarning(false);
      await cancelStreakWarning();
      return;
    }
    const granted = await requestPermission();
    if (!granted) {
      Alert.alert(
        "Notifications are off",
        "Turn them on for Cruxe in your device settings to get reminders.",
      );
      return;
    }
    settings.setStreakWarning(true);
  };

  /**
   * Runs the first-run tutorial again. The tutorial screen stashes and
   * restores any puzzle already in progress, so this is safe mid-solve.
   */
  const handleReplayTutorial = () => {
    triggerHaptic();
    router.push("/(auth)/tutorial");
  };

  /**
   * Permanent account deletion — required by Apple guideline 5.1.1(v) and
   * Google Play policy. The consequences are stated plainly rather than
   * buried, because coins are genuinely forfeited and not refundable.
   */
  const handleDeleteAccount = () => {
    triggerHaptic();
    Alert.alert(
      "Delete account?",
      "This permanently erases your profile, progress, streak, and remaining " +
        "coins. Purchased coins are not refundable. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setBusyAction("delete");

              // Server delete, local teardown and a fresh guest session, in
              // that order and all-or-nothing about the parts that matter.
              // Defaults chosen so an unexpected throw below leaves the
              // account presumed intact — the safe assumption, since it
              // keeps the user on a screen where they can try again.
              let accountDeleted = false;
              let error: string | null = "Could not delete account";
              try {
                ({ accountDeleted, error } = await deleteAccountAndReset());
              } catch (e: any) {
                error = e?.message ?? "Could not delete account";
              }

              // Device-level state the auth layer has no business knowing
              // about. Tied to `accountDeleted`, not to the absence of an
              // error: a deletion that succeeded but could not open a new
              // session still has to leave the device clean, or the next
              // launch skips onboarding and reminders keep firing about a
              // streak that no longer exists.
              //
              // Each step is guarded separately. A throw from the
              // notifications API must not skip the onboarding reset, and
              // neither may skip the navigation away from this screen.
              if (accountDeleted) {
                try {
                  await cancelAll();
                } catch (e) {
                  console.warn("[Profile] Could not cancel notifications:", e);
                }
                try {
                  useSettingsStore.getState().resetFirstRun();
                } catch (e) {
                  console.warn("[Profile] Could not reset first-run flags:", e);
                }
              }

              setBusyAction(null);

              if (error) {
                Alert.alert(
                  accountDeleted ? "Account deleted" : "Could not delete account",
                  error,
                );
              }

              // Genuinely fresh: welcome and tutorial, as a new install.
              // Only the account surviving keeps the user on this screen.
              if (accountDeleted) {
                router.replace("/(auth)/welcome");
              }
            })();
          },
        },
      ],
    );
  };

  const formatCategoryTitle = (catKey: string) => {
    if (catKey === "daily_challenge") return "Daily Challenge";
    return (
      CATEGORIES[catKey as keyof typeof CATEGORIES]?.title ||
      catKey.toUpperCase()
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title="Profile" subtitle="Your stats, account and settings" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.identityCard}>
          <View style={styles.avatarGlow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(profile?.displayName || "Player").charAt(0)}
              </Text>
            </View>
          </View>
          <Text style={styles.name}>{profile?.displayName || "Player"}</Text>
          <View style={styles.badgePill}>
            <MaterialIcons
              name="stars"
              size={14}
              color={theme.colors.accentGold}
            />
            <Text style={styles.subtitle}>Cruxe Member</Text>
          </View>
        </View>

        {/* Statistics Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Performance</Text>
        </View>

        <View style={styles.statsCard}>
          <View style={styles.statHeroRow}>
            <View style={styles.heroStatBox}>
              <MaterialIcons
                name="local-fire-department"
                size={24}
                color="#F59E0B"
              />
              <Text style={styles.heroStatValue}>{profile?.currentStreak || 0}</Text>
              <Text style={styles.heroStatLabel}>STREAK</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.heroStatBox}>
              <MaterialIcons
                name="star"
                size={24}
                color={theme.colors.accentGold}
              />
              <Text style={styles.heroStatValue}>
                {formatCompactNumber(profile.totalScore || 0)}
              </Text>
              <Text style={styles.heroStatLabel}>TOTAL SCORE</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.heroStatBox}>
              <MaterialIcons
                name="grid-on"
                size={24}
                color={theme.colors.accentGreen}
              />
              <Text style={styles.heroStatValue}>
                {profile?.totalPuzzlesSolved || 0}
              </Text>
              <Text style={styles.heroStatLabel}>SOLVED</Text>
            </View>
          </View>
        </View>

        <Text
          style={[
            styles.sectionTitle,
            { marginTop: 32, marginBottom: 16 },
          ]}
        >
          Category Mastery
        </Text>
        <View style={styles.categoryGrid}>
          {Object.entries(profile?.categoryStats || {}).map(([cat, stats]) => (
            <View key={cat} style={styles.categoryBox}>
              <View style={styles.catIconWrap}>
                <MaterialIcons
                  name={
                    cat === "daily_challenge"
                      ? "event"
                      : (CATEGORIES[cat as keyof typeof CATEGORIES]
                          ?.icon as any) || "category"
                  }
                  size={20}
                  color={theme.colors.accentGold}
                />
              </View>
              <View style={styles.catMeta}>
                <Text style={styles.catTitle}>{formatCategoryTitle(cat)}</Text>
                <Text style={styles.catScore}>{stats.solved} Solved</Text>
              </View>
            </View>
          ))}
          {Object.keys(profile?.categoryStats || {}).length === 0 && (
            <Text style={styles.emptyText}>
              Complete puzzles to unlock stats.
            </Text>
          )}
        </View>

        {/* Account Settings */}
        <Text
          style={[
            styles.sectionTitle,
            { marginTop: 32, marginBottom: 16 },
          ]}
        >
          Account & Sync
        </Text>
        <View style={styles.settingsGroup}>
          {Platform.OS === "ios" && (
            <>
              <TouchableOpacity
                style={styles.settingRow}
                onPress={handleAppleLink}
                disabled={isBusy || linked.hasApple}
              >
                <View style={styles.settingInfo}>
                  <View style={styles.settingIconWrap}>
                    <Ionicons
                      name="logo-apple"
                      size={18}
                      color={theme.colors.textPrimary}
                    />
                  </View>
                  <View>
                    <Text style={styles.settingText}>Sign in with Apple</Text>
                    {linked.hasApple && (
                      <Text style={styles.connectedLabel}>Connected</Text>
                    )}
                  </View>
                </View>
                {busyAction === "apple" ? (
                  <ActivityIndicator
                    size="small"
                    color={theme.colors.accentGold}
                  />
                ) : linked.hasApple ? (
                  <Ionicons
                    name="checkmark-circle"
                    size={22}
                    color={theme.colors.accentGreen}
                  />
                ) : (
                  <MaterialIcons
                    name="chevron-right"
                    size={24}
                    color={theme.colors.textMuted}
                  />
                )}
              </TouchableOpacity>
              <View style={styles.settingDivider} />
            </>
          )}

          <TouchableOpacity
            style={styles.settingRow}
            onPress={handleGoogleLink}
            disabled={isBusy || linked.hasGoogle}
          >
            <View style={styles.settingInfo}>
              <View style={styles.settingIconWrap}>
                <Ionicons
                  name="logo-google"
                  size={18}
                  color={theme.colors.textPrimary}
                />
              </View>
              <View>
                <Text style={styles.settingText}>Sign in with Google</Text>
                {linked.hasGoogle && (
                  <Text style={styles.connectedLabel}>Connected</Text>
                )}
              </View>
            </View>
            {busyAction === "google" ? (
              <ActivityIndicator size="small" color={theme.colors.accentGold} />
            ) : linked.hasGoogle ? (
              <Ionicons
                name="checkmark-circle"
                size={22}
                color={theme.colors.accentGreen}
              />
            ) : (
              <MaterialIcons
                name="chevron-right"
                size={24}
                color={theme.colors.textMuted}
              />
            )}
          </TouchableOpacity>

          <View style={styles.settingDivider} />

          <TouchableOpacity
            style={styles.settingRow}
            onPress={handleSignOut}
            disabled={isBusy}
          >
            <View style={styles.settingInfo}>
              <View style={styles.settingIconWrap}>
                <MaterialIcons
                  name="logout"
                  size={18}
                  color={theme.colors.accentRed}
                />
              </View>
              <Text style={[styles.settingText, { color: theme.colors.textPrimary }]}>
                Sign out
              </Text>
            </View>
            {busyAction === "signOut" ? (
              <ActivityIndicator
                size="small"
                color={theme.colors.accentGold}
              />
            ) : (
              <MaterialIcons
                name="chevron-right"
                size={24}
                color={theme.colors.textMuted}
              />
            )}
          </TouchableOpacity>

          <View style={styles.settingDivider} />

          <TouchableOpacity
            style={styles.settingRow}
            onPress={handleReplayTutorial}
            accessibilityRole="button"
            accessibilityLabel="Replay the tutorial"
          >
            <View style={styles.settingInfo}>
              <View style={styles.settingIconWrap}>
                <MaterialIcons
                  name="school"
                  size={18}
                  color={theme.colors.accentGold}
                />
              </View>
              <Text style={styles.settingText}>Replay tutorial</Text>
            </View>
            <MaterialIcons
              name="chevron-right"
              size={24}
              color={theme.colors.textMuted}
            />
          </TouchableOpacity>

          <View style={styles.settingDivider} />

          {/* Permanent deletion — required for App Store and Play review */}
          <TouchableOpacity
            style={styles.settingRow}
            onPress={handleDeleteAccount}
            disabled={isBusy}
          >
            <View style={styles.settingInfo}>
              <View style={styles.settingIconWrap}>
                <MaterialIcons
                  name="delete-forever"
                  size={18}
                  color="#ef4444"
                />
              </View>
              <Text style={[styles.settingText, { color: "#ef4444" }]}>
                Delete account
              </Text>
            </View>
            {busyAction === "delete" ? (
              // This row never had a spinner of its own: the old shared flag
              // lit up the Google and Sign out rows instead, which is what
              // made deleting look like it was signing in.
              <ActivityIndicator size="small" color="#ef4444" />
            ) : (
              <MaterialIcons
                name="chevron-right"
                size={24}
                color={theme.colors.textMuted}
              />
            )}
          </TouchableOpacity>
        </View>

        {/* App Settings */}
        <Text
          style={[
            styles.sectionTitle,
            { marginTop: 32, marginBottom: 16 },
          ]}
        >
          App Settings
        </Text>
        <View style={styles.settingsGroup}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <View style={styles.settingIconWrap}>
                <Ionicons
                  name="notifications"
                  size={18}
                  color={theme.colors.textPrimary}
                />
              </View>
              <View style={styles.settingTextWrap}>
                <Text style={styles.settingText}>Daily reminder</Text>
                <Text style={styles.settingSubtext}>
                  {settings.dailyReminderHour}:00, when new puzzles land
                </Text>
              </View>
            </View>
            <Switch
              value={settings.dailyReminderEnabled}
              onValueChange={handleDailyReminder}
              accessibilityLabel="Daily puzzle reminder"
              trackColor={{
                true: theme.colors.accentGold,
                false: "rgba(255,255,255,0.1)",
              }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.settingDivider} />

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <View style={styles.settingIconWrap}>
                <Ionicons
                  name="flame"
                  size={18}
                  color={theme.colors.textPrimary}
                />
              </View>
              <View style={styles.settingTextWrap}>
                <Text style={styles.settingText}>Streak warning</Text>
                <Text style={styles.settingSubtext}>
                  Only if your streak is at risk tonight
                </Text>
              </View>
            </View>
            <Switch
              value={settings.streakWarningEnabled}
              onValueChange={handleStreakWarning}
              accessibilityLabel="Warn me when my streak is at risk"
              trackColor={{
                true: theme.colors.accentGold,
                false: "rgba(255,255,255,0.1)",
              }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.settingDivider} />

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <View style={styles.settingIconWrap}>
                <Ionicons
                  name="volume-high"
                  size={18}
                  color={theme.colors.textPrimary}
                />
              </View>
              <Text style={styles.settingText}>Sound Effects</Text>
            </View>
            <Switch
              value={settings.soundEnabled}
              onValueChange={settings.setSound}
              trackColor={{
                true: theme.colors.accentGold,
                false: "rgba(255,255,255,0.1)",
              }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.settingDivider} />

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <View style={styles.settingIconWrap}>
                <Ionicons
                  name="hardware-chip"
                  size={18}
                  color={theme.colors.textPrimary}
                />
              </View>
              <Text style={styles.settingText}>Haptic Feedback</Text>
            </View>
            <Switch
              value={settings.hapticsEnabled}
              onValueChange={settings.setHaptics}
              trackColor={{
                true: theme.colors.accentGold,
                false: "rgba(255,255,255,0.1)",
              }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* About & Legal Section */}
        <Text
          style={[
            styles.sectionTitle,
            { marginTop: 32, marginBottom: 16 },
          ]}
        >
          About & Legal
        </Text>
        <View style={styles.settingsGroup}>
          <TouchableOpacity 
            style={styles.settingRow} 
            onPress={() => router.push("/legal/privacy")}
          >
            <View style={styles.settingInfo}>
              <View style={styles.settingIconWrap}>
                <MaterialIcons name="privacy-tip" size={18} color={theme.colors.textPrimary} />
              </View>
              <Text style={styles.settingText}>Privacy Policy</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={theme.colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.settingDivider} />

          <TouchableOpacity 
            style={styles.settingRow} 
            onPress={() => router.push("/legal/terms")}
          >
            <View style={styles.settingInfo}>
              <View style={styles.settingIconWrap}>
                <MaterialIcons name="gavel" size={18} color={theme.colors.textPrimary} />
              </View>
              <Text style={styles.settingText}>Terms of Service</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={theme.colors.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.versionText}>Cruxe v1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
  },
  identityCard: {
    alignItems: "center",
    paddingVertical: 24,
    marginTop: 4,
    marginBottom: 32,
    backgroundColor: theme.colors.bgSecondary,
    borderRadius: theme.borderRadius.card,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  avatarGlow: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(238, 205, 43, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(238, 205, 43, 0.3)",
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.bgPrimary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: theme.colors.accentGold,
  },
  avatarText: {
    fontFamily: theme.typography.display.fontFamily,
    fontSize: 28,
    color: theme.colors.accentGold,
    fontWeight: "bold",
  },
  name: {
    fontFamily: theme.typography.heading.fontFamily,
    fontSize: 22,
    color: theme.colors.textPrimary,
    fontWeight: "bold",
    marginBottom: 8,
  },
  badgePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(238, 205, 43, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 100,
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(238, 205, 43, 0.2)",
  },
  subtitle: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 12,
    color: theme.colors.accentGold,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  content: {
    padding: 24,
    paddingTop: 0,
    paddingBottom: 40,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: theme.typography.heading.fontFamily,
    fontSize: 18,
    color: theme.colors.textPrimary,
  },
  statsCard: {
    backgroundColor: theme.colors.bgSecondary,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  statHeroRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroStatBox: {
    flex: 1,
    alignItems: "center",
    gap: 8,
  },
  statDivider: {
    width: 1,
    height: 48,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginHorizontal: 16,
  },
  heroStatValue: {
    fontFamily: theme.typography.display.fontFamily,
    fontSize: 28,
    color: theme.colors.textPrimary,
    fontWeight: "bold",
  },
  heroStatLabel: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 8,
    color: theme.colors.textSecondary,
    letterSpacing: 1,
    fontWeight: "bold",
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    // space-between supplies the column gutter out of the leftover 4%, so
    // the pair always fits. A fixed `gap` on top of 2x48% is a rounding
    // error away from overflowing and collapsing to one card per row.
    justifyContent: "space-between",
    rowGap: 12,
  },
  categoryBox: {
    width: "48%",
    backgroundColor: theme.colors.bgSecondary,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  catIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  catMeta: {
    flex: 1,
    minWidth: 0,
  },
  catTitle: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 14,
    color: theme.colors.textPrimary,
    fontWeight: "bold",
    marginBottom: 4,
  },
  catScore: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 11,
    color: theme.colors.accentGold,
    fontWeight: "bold",
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontFamily: theme.typography.body.fontFamily,
    fontStyle: "italic",
    padding: 16,
  },
  settingsGroup: {
    backgroundColor: theme.colors.bgSecondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    overflow: "hidden",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  settingDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    marginLeft: 56,
  },
  settingInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    // Take the available width so the trailing control stays on screen.
    // Without this a row with a subtitle overflows and pushes it out.
    flex: 1,
    minWidth: 0,
  },
  settingIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  settingTextWrap: { flex: 1, minWidth: 0 },
  settingSubtext: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  settingText: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  connectedLabel: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: 12,
    color: theme.colors.accentGreen,
    marginTop: 2,
  },
  footer: {
    marginTop: 40,
    alignItems: "center",
  },
  versionText: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 12,
    color: theme.colors.textMuted,
    letterSpacing: 2,
  },
});
