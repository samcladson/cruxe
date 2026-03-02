import { MaterialIcons } from "@expo/vector-icons";
import React, { useEffect } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../../constants/theme";

// MOCK DATA
const LEADERBOARD = [
  {
    id: "1",
    name: "Julian",
    points: 12450,
    streak: 42,
    rank: 1,
    avatarColor: theme.colors.accentGold,
  },
  {
    id: "2",
    name: "SarahM",
    points: 11200,
    streak: 28,
    rank: 2,
    avatarColor: "#C0C0C0",
  }, // Silver
  {
    id: "3",
    name: "CruxPzl",
    points: 10850,
    streak: 15,
    rank: 3,
    avatarColor: "#CD7F32",
  }, // Bronze
  { id: "4", name: "Player492", points: 9400, streak: 8, rank: 4 },
  { id: "5", name: "WordMaster", points: 8850, streak: 12, rank: 5 },
  { id: "6", name: "CrossGuy", points: 7200, streak: 5, rank: 6 },
  { id: "7", name: "EmmaW", points: 6150, streak: 2, rank: 7 },
  { id: "8", name: "Novice", points: 4000, streak: 1, rank: 8 },
];

function PodiumBar({ rank, user, height, delay }: any) {
  const animatedHeight = useSharedValue(0);

  useEffect(() => {
    animatedHeight.value = withDelay(
      delay,
      withSpring(height, { damping: 15 }),
    );
  }, []);

  const barStyle = useAnimatedStyle(() => ({
    height: animatedHeight.value,
  }));

  const bgColors: any = {
    1: theme.colors.accentGold,
    2: "#e5e7eb", // Silverish
    3: "#ca8a04", // Bronzeish
  };

  const barColor = bgColors[rank];

  return (
    <View style={styles.podiumColumn}>
      <Animated.View
        entering={FadeInDown.delay(delay + 300).springify()}
        style={styles.podiumAvatarWrap}
      >
        <View style={styles.podiumAvatar}>
          <MaterialIcons name="person" size={24} color={barColor} />
        </View>
        <Text style={styles.podiumName} numberOfLines={1}>
          {user.name}
        </Text>
        <Text style={styles.podiumPoints}>{user.points}</Text>
      </Animated.View>

      <Animated.View
        style={[styles.podiumBar, barStyle, { backgroundColor: barColor }]}
      >
        <Text style={styles.podiumRankText}>{rank}</Text>
      </Animated.View>
    </View>
  );
}

export default function LeaderboardScreen() {
  const topThree = LEADERBOARD.slice(0, 3);
  const restList = LEADERBOARD.slice(3);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Leaderboard</Text>
        <Text style={styles.subtitle}>Top players this week</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Podium Section (2 - 1 - 3 Order) */}
        <View style={styles.podiumSection}>
          <PodiumBar rank={2} user={topThree[1]} height={120} delay={200} />
          <PodiumBar rank={1} user={topThree[0]} height={160} delay={0} />
          <PodiumBar rank={3} user={topThree[2]} height={90} delay={400} />
        </View>

        {/* List Section */}
        <View style={styles.listSection}>
          {restList.map((player, index) => (
            <Animated.View
              key={player.id}
              entering={FadeInDown.delay(600 + index * 100).springify()}
              style={styles.listRow}
            >
              <View style={styles.listRankBox}>
                <Text style={styles.listRankText}>{player.rank}</Text>
              </View>
              <View style={styles.listAvatar}>
                <MaterialIcons
                  name="person"
                  size={20}
                  color={theme.colors.textMuted}
                />
              </View>
              <View style={styles.listPlayerInfo}>
                <Text style={styles.listPlayerName}>{player.name}</Text>
                <View style={styles.listPlayerMeta}>
                  <MaterialIcons
                    name="local-fire-department"
                    size={12}
                    color={theme.colors.accentGold}
                  />
                  <Text style={styles.listStreakText}>
                    {player.streak} streak
                  </Text>
                </View>
              </View>
              <View style={styles.listScoreBox}>
                <Text style={styles.listScoreText}>{player.points}</Text>
                <Text style={styles.listScoreLabel}>PTS</Text>
              </View>
            </Animated.View>
          ))}
          <View style={{ height: 100 }} /> {/* Padding for Floating Tab Bar */}
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
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
    backgroundColor: theme.colors.bgPrimary,
  },
  title: {
    fontFamily: theme.typography.display.fontFamily,
    fontSize: 32,
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: theme.typography.body.fontFamily,
    color: theme.colors.textSecondary,
  },
  content: {
    flexGrow: 1,
  },
  podiumSection: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
    paddingHorizontal: 24,
    marginTop: 40,
    marginBottom: 40,
    height: 240, // Fixed height for animation container
    gap: 12,
  },
  podiumColumn: {
    alignItems: "center",
    width: "30%",
  },
  podiumAvatarWrap: {
    alignItems: "center",
    marginBottom: 12,
  },
  podiumAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.bgSecondary,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  podiumName: {
    fontFamily: theme.typography.subheading.fontFamily,
    fontSize: 12,
    color: theme.colors.textPrimary,
    marginBottom: 4,
    textAlign: "center",
  },
  podiumPoints: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 10,
    color: theme.colors.accentGold,
    fontWeight: "bold",
  },
  podiumBar: {
    width: "100%",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    justifyContent: "flex-start",
    alignItems: "center",
    paddingTop: 16,
    shadowColor: theme.colors.accentGold,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
  },
  podiumRankText: {
    fontFamily: theme.typography.display.fontFamily,
    fontSize: 24,
    color: theme.colors.bgPrimary,
  },
  listSection: {
    paddingHorizontal: 24,
    backgroundColor: theme.colors.bgSecondary,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 32,
    minHeight: 500,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.bgPrimary,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  listRankBox: {
    width: 32,
    alignItems: "center",
  },
  listRankText: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 16,
    fontWeight: "bold",
    color: theme.colors.textSecondary,
  },
  listAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.bgSecondary,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  listPlayerInfo: {
    flex: 1,
  },
  listPlayerName: {
    fontFamily: theme.typography.heading.fontFamily,
    fontSize: 16,
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  listPlayerMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  listStreakText: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  listScoreBox: {
    alignItems: "flex-end",
  },
  listScoreText: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 16,
    fontWeight: "bold",
    color: theme.colors.textPrimary,
  },
  listScoreLabel: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: 10,
    color: theme.colors.accentGold,
    marginTop: 2,
  },
});
