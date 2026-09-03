import { MaterialIcons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { theme } from "@/constants/theme";

export default function NotFoundScreen() {
  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScreenHeader title="Page Not Found" showBack />

      <View style={styles.body}>
        <MaterialIcons
          name="explore-off"
          size={48}
          color="rgba(255,255,255,0.1)"
        />
        <Text style={styles.message}>This screen doesn&apos;t exist.</Text>

        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Go to home screen</Text>
        </Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
  },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  message: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 15,
    color: theme.colors.textMuted,
    marginTop: 16,
  },
  link: {
    marginTop: 24,
    paddingVertical: 12,
  },
  linkText: {
    fontFamily: theme.typography.subheading.fontFamily,
    fontSize: 15,
    color: theme.colors.accentGold,
  },
});
