import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { theme } from "../../constants/theme";

interface ScreenHeaderProps {
  /** The one label that names the screen. Never repeat it inside the body. */
  title: string;
  /** Optional single line of context under the title. */
  subtitle?: string;
  /** Shows the back affordance in the nav row above the title. */
  showBack?: boolean;
  /** Defaults to `router.back()`. */
  onBack?: () => void;
  /** Trailing accessory for the nav row (stats pill, action button, …). */
  right?: React.ReactNode;
  /** Leading glyph rendered beside the title, for screens with an identity. */
  icon?: keyof typeof MaterialIcons.glyphMap;
  style?: StyleProp<ViewStyle>;
}

/**
 * The single page header used by every screen in the app.
 *
 * The nav row (back button / trailing accessory) sits above the title so the
 * title always starts at the same x-offset whether or not a screen can go
 * back. Screens that use this must not render the native stack header as well.
 */
export function ScreenHeader({
  title,
  subtitle,
  showBack = false,
  onBack,
  right,
  icon,
  style,
}: ScreenHeaderProps) {
  const hasNavRow = showBack || Boolean(right);

  return (
    <View style={[styles.wrap, style]}>
      {hasNavRow && (
        <View style={styles.navRow}>
          {showBack ? (
            <TouchableOpacity
              onPress={onBack ?? (() => router.back())}
              style={styles.backBtn}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <MaterialIcons
                name="arrow-back"
                size={24}
                color={theme.colors.textPrimary}
              />
            </TouchableOpacity>
          ) : (
            <View style={styles.navSpacer} />
          )}
          {right}
        </View>
      )}

      <View style={styles.titleRow}>
        {icon && (
          <View style={styles.iconBox}>
            <MaterialIcons
              name={icon}
              size={22}
              color={theme.colors.accentGold}
            />
          </View>
        )}
        <View style={styles.titleCol}>
          <Text
            style={styles.title}
            numberOfLines={1}
            accessibilityRole="header"
          >
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 20,
    backgroundColor: theme.colors.bgPrimary,
    zIndex: 20,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 40,
    marginBottom: 4,
  },
  backBtn: {
    width: 40,
    height: 40,
    // Pulls the glyph out to the wrap's padding so it optically lines up
    // with the title's left edge.
    marginLeft: -8,
    alignItems: "center",
    justifyContent: "center",
  },
  navSpacer: {
    width: 0,
    height: 40,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.card,
    borderWidth: 1,
    borderColor: theme.colors.accentGold + "40",
    backgroundColor: theme.colors.bgSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  titleCol: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: theme.typography.display.fontFamily,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.5,
    color: theme.colors.textPrimary,
  },
  subtitle: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
});
