import { MaterialIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { Platform } from "react-native";
import { theme } from "../../constants/theme";

/**
 * Tab layout with a clean bottom navigation bar.
 * Active: white icon, slightly larger.
 * Inactive: gold icon, standard size.
 */
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: "#ffffff",
        tabBarInactiveTintColor: theme.colors.accentGold,
        tabBarStyle: {
          backgroundColor: theme.colors.bgPrimary,
          borderTopWidth: 1,
          borderTopColor: "rgba(255, 255, 255, 0.06)",
          height: Platform.OS === "ios" ? 88 : 64,
          paddingBottom: Platform.OS === "ios" ? 28 : 8,
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
      {/* Hide the archived full home screen from the tab bar */}
      <Tabs.Screen
        name="index_full"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
