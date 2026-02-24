import { MaterialIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { theme } from "../../constants/theme";

/**
 * Tab layout with a premium bottom navigation bar.
 * Sticks to the bottom of the screen with a clean, dark design.
 * Active tab shows a gold icon+label pill indicator.
 */
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#0d0d0d",
          borderTopWidth: 1,
          borderTopColor: "rgba(255, 255, 255, 0.06)",
          height: Platform.OS === "ios" ? 88 : 64,
          paddingBottom: Platform.OS === "ios" ? 28 : 8,
          paddingTop: 8,
          elevation: 0,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -8 },
          shadowOpacity: 0.4,
          shadowRadius: 16,
        },
        tabBarActiveTintColor: "#1a1810",
        tabBarInactiveTintColor: "rgba(255,255,255,0.55)",
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeTab : styles.inactiveTab}>
              <MaterialIcons
                name="home-filled"
                size={22}
                color={focused ? "#1a1810" : color}
              />
              {focused && <Text style={styles.activeLabel}>Home</Text>}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="store"
        options={{
          title: "Store",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeTab : styles.inactiveTab}>
              <MaterialIcons
                name="storefront"
                size={22}
                color={focused ? "#1a1810" : color}
              />
              {focused && <Text style={styles.activeLabel}>Store</Text>}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeTab : styles.inactiveTab}>
              <MaterialIcons
                name="person"
                size={22}
                color={focused ? "#1a1810" : color}
              />
              {focused && <Text style={styles.activeLabel}>Profile</Text>}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: "Ranks",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeTab : styles.inactiveTab}>
              <MaterialIcons
                name="emoji-events"
                size={22}
                color={focused ? "#1a1810" : color}
              />
              {focused && <Text style={styles.activeLabel}>Ranks</Text>}
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  activeTab: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.accentGold,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
    gap: 6,
    shadowColor: theme.colors.accentGold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  inactiveTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  activeLabel: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 12,
    fontWeight: "bold",
    color: "#1a1810",
    letterSpacing: 0.5,
  },
});
