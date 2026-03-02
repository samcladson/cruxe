import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import React from "react";
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CATEGORIES } from "../../constants/categories";
import { theme } from "../../constants/theme"; // Keep theme imported as it's used elsewhere
import { useSettingsStore } from "../../stores/settingsStore";
import { useUserStore } from "../../stores/userStore";
import { formatCompactNumber } from "../../utils/formatNumber";

export default function ProfileScreen() {
  const profile = useUserStore((state) => state.profile);
  const settings = useSettingsStore();

  const formatCategoryTitle = (catKey: string) => {
    if (catKey === "daily_challenge") return "Daily Challenge";
    return (
      CATEGORIES[catKey as keyof typeof CATEGORIES]?.title ||
      catKey.toUpperCase()
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.avatarGlow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {profile.displayName.charAt(0)}
            </Text>
          </View>
        </View>
        <Text style={styles.name}>{profile.displayName}</Text>
        <View style={styles.badgePill}>
          <MaterialIcons
            name="stars"
            size={14}
            color={theme.colors.accentGold}
          />
          <Text style={styles.subtitle}>Cruxe Member</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
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
              <Text style={styles.heroStatValue}>{profile.currentStreak}</Text>
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
                {profile.totalPuzzlesSolved}
              </Text>
              <Text style={styles.heroStatLabel}>SOLVED</Text>
            </View>
          </View>
        </View>

        <Text
          style={[
            styles.sectionTitle,
            { marginTop: 32, marginBottom: 16, paddingHorizontal: 4 },
          ]}
        >
          Category Mastery
        </Text>
        <View style={styles.categoryGrid}>
          {Object.entries(profile.categoryStats).map(([cat, stats]) => (
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
          {Object.keys(profile.categoryStats).length === 0 && (
            <Text style={styles.emptyText}>
              Complete puzzles to unlock stats.
            </Text>
          )}
        </View>

        {/* Settings Section */}
        <Text
          style={[
            styles.sectionTitle,
            { marginTop: 32, marginBottom: 16, paddingHorizontal: 4 },
          ]}
        >
          App Settings
        </Text>
        <View style={styles.settingsGroup}>
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
  header: {
    alignItems: "center",
    paddingTop: 32,
    paddingBottom: 24,
    backgroundColor: theme.colors.bgSecondary,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
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
    padding: 20,
    paddingBottom: 40,
  },
  sectionHeader: {
    paddingHorizontal: 4,
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
    gap: 12,
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
  },
  settingIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  settingText: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 16,
    color: theme.colors.textPrimary,
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
