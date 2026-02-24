import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { theme } from "../../constants/theme";
import { useSettingsStore } from "../../stores/settingsStore";
import { useUserStore } from "../../stores/userStore";

export default function ProfileScreen() {
  const profile = useUserStore((state) => state.profile);
  const settings = useSettingsStore();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{profile.displayName.charAt(0)}</Text>
        </View>
        <Text style={styles.name}>{profile.displayName}</Text>
        <Text style={styles.subtitle}>Cruxe Member</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Statistics</Text>

        <View style={styles.statsGrid}>
          {Object.entries(profile.categoryStats).map(([cat, stats]) => (
            <View key={cat} style={styles.statBox}>
              <Text style={styles.statCat}>{cat}</Text>
              <Text style={styles.statScore}>{stats.solved}</Text>
              <Text style={styles.statLabel}>Solved</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 32 }]}>Settings</Text>
        <View style={styles.settingsCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons
                name="volume-high"
                size={20}
                color={theme.colors.textPrimary}
                style={{ marginRight: 12 }}
              />
              <Text style={styles.settingText}>Sound Effects</Text>
            </View>
            <Switch
              value={settings.soundEnabled}
              onValueChange={settings.setSound}
              trackColor={{
                true: theme.colors.accentGold,
                false: theme.colors.bgPrimary,
              }}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons
                name="phone-portrait"
                size={20}
                color={theme.colors.textPrimary}
                style={{ marginRight: 12 }}
              />
              <Text style={styles.settingText}>Haptic Feedback</Text>
            </View>
            <Switch
              value={settings.hapticsEnabled}
              onValueChange={settings.setHaptics}
              trackColor={{
                true: theme.colors.accentGold,
                false: theme.colors.bgPrimary,
              }}
            />
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.versionText}>Cruxe v1.0.0</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
  },
  header: {
    alignItems: "center",
    paddingTop: 80,
    paddingBottom: 40,
    backgroundColor: theme.colors.bgSecondary,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.cellBorder,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.bgTertiary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: theme.colors.accentGold,
    marginBottom: 16,
  },
  avatarText: {
    fontFamily: theme.typography.display.fontFamily,
    fontSize: 32,
    color: theme.colors.accentGold,
  },
  name: {
    fontFamily: theme.typography.display.fontFamily,
    fontSize: 24,
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: theme.typography.body.fontFamily,
    color: theme.colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 12,
  },
  content: {
    padding: 24,
  },
  sectionTitle: {
    fontFamily: theme.typography.heading.fontFamily,
    fontSize: 20,
    color: theme.colors.textPrimary,
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statBox: {
    width: "48%",
    backgroundColor: theme.colors.bgSecondary,
    padding: 16,
    borderRadius: theme.borderRadius.card,
    borderWidth: 1,
    borderColor: theme.colors.cellBorder,
  },
  statCat: {
    fontFamily: theme.typography.subheading.fontFamily,
    fontSize: 12,
    color: theme.colors.textSecondary,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  statScore: {
    fontFamily: theme.typography.heading.fontFamily,
    fontSize: 24,
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  statLabel: {
    fontFamily: theme.typography.caption.fontFamily,
    color: theme.colors.textMuted,
  },
  settingsCard: {
    backgroundColor: theme.colors.bgSecondary,
    borderRadius: theme.borderRadius.card,
    borderWidth: 1,
    borderColor: theme.colors.cellBorder,
    overflow: "hidden",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.cellBorder,
  },
  settingInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  settingText: {
    fontFamily: theme.typography.subheading.fontFamily,
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  footer: {
    marginTop: 40,
    alignItems: "center",
  },
  versionText: {
    fontFamily: theme.typography.caption.fontFamily,
    color: theme.colors.textMuted,
  },
});
