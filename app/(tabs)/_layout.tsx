import { MaterialIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "../../constants/theme";
import { TAB_BAR_CONTENT_HEIGHT } from "../../utils/tabBar";


/**
 * Tab layout with a clean bottom navigation bar.
 * Active: white icon, slightly larger.
 * Inactive: gold icon, standard size.
 */
export default function TabLayout() {
  // The bottom inset is whatever the device reserves: the home indicator on
  // iOS, and on Android — which draws edge-to-edge — either a thin gesture
  // strip or the full three-button bar. Fixed per-platform numbers only ever
  // matched the first two, so on phones with navigation buttons the buttons
  // sat on top of the tabs.
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 8);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        freezeOnBlur: true,
        tabBarShowLabel: false,
        tabBarActiveTintColor: "#ffffff",
        tabBarInactiveTintColor: theme.colors.accentGold,
        tabBarStyle: {
          // Transparent and floating: screens draw their own backdrop under
          // it, and their content fades out beneath the icons instead of
          // ending at a solid bar with a line above it.
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "transparent",
          borderTopWidth: 0,
          height: TAB_BAR_CONTENT_HEIGHT + bottomPadding,
          paddingBottom: bottomPadding,
          paddingTop: 8,
          elevation: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons name="home-filled" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="collection"
        options={{
          title: "Collection",
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="grid-view" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="store"
        options={{
          title: "Store",
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons name="storefront" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: "Ranks",
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons name="emoji-events" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons name="person" size={24} color={color} />
          ),
        }}
      />
      {/* Reached from Recent Activity, not from the bar. It lives inside the
          tab group so the bottom navigation stays visible on it. */}
      <Tabs.Screen
        name="activity"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
