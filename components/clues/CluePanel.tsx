import { MaterialIcons } from "@expo/vector-icons";
import React, { useRef } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { theme } from "../../constants/theme";
import { usePuzzleStore } from "../../stores/puzzleStore";
import { CrosswordClue, Direction } from "../../types/puzzle.types";

interface ClueItemProps {
  clue: CrosswordClue;
  isActive: boolean;
  onPress: () => void;
}

/**
 * A single clue row showing its number and text.
 * Highlights gold when it's the active clue.
 */
const ClueItem = React.memo(({ clue, isActive, onPress }: ClueItemProps) => {
  return (
    <TouchableOpacity
      style={[styles.itemRef, isActive ? styles.itemActive : null]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text
        style={[styles.itemNumber, isActive ? styles.itemNumberActive : null]}
      >
        {clue.number}
      </Text>
      <Text style={[styles.itemText, isActive ? styles.itemTextActive : null]}>
        {clue.clue}
      </Text>
    </TouchableOpacity>
  );
});

/**
 * Direction tab labels matching the 4 directions.
 */
const DIRECTION_TABS: { key: Direction; label: string; icon: string }[] = [
  { key: "across", label: "ACROSS", icon: "arrow-forward" },
  { key: "down", label: "DOWN", icon: "arrow-downward" },
  { key: "reverse_across", label: "BACK", icon: "arrow-back" },
  { key: "reverse_down", label: "UP", icon: "arrow-upward" },
];

/**
 * CluePanel displays all clues organized by direction with 4 tabs:
 * Across, Down, Backwards, and Up.
 */
export function CluePanel() {
  const {
    activePuzzle,
    selectedCell,
    selectedDirection,
    selectCell,
    checkAnswers,
    checksRemaining,
    decrementCheck,
    isGridCompletelyFilled,
    checkCompletion,
  } = usePuzzleStore();
  const scrollViewRef = useRef<ScrollView>(null);

  if (!activePuzzle) return null;

  const getActiveClueId = () => {
    if (!selectedCell) return null;
    const currentCell = activePuzzle.grid[selectedCell.row][selectedCell.col];
    let targetId = currentCell.clueIds.find((id) =>
      id.includes(selectedDirection),
    );
    if (!targetId && currentCell.clueIds.length > 0)
      targetId = currentCell.clueIds[0];
    return targetId;
  };

  const [activeTab, setActiveTab] = React.useState<Direction>("across");
  const activeClueId = getActiveClueId();

  const handleCluePress = (clue: CrosswordClue) => {
    selectCell(clue.startRow, clue.startCol);
  };

  // Get clues for the active tab
  const getCluesForDirection = (dir: Direction): CrosswordClue[] => {
    switch (dir) {
      case "across":
        return activePuzzle.acrossClues;
      case "down":
        return activePuzzle.downClues;
      case "reverse_across":
        return activePuzzle.reverseAcrossClues;
      case "reverse_down":
        return activePuzzle.reverseDownClues;
      default:
        return [];
    }
  };

  const currentClues = getCluesForDirection(activeTab);

  // Only show tabs that have clues
  const availableTabs = DIRECTION_TABS.filter(
    (tab) => getCluesForDirection(tab.key).length > 0,
  );

  return (
    <View style={styles.container}>
      {/* Direction Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsHeader}
      >
        {availableTabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tabBtn,
              activeTab === tab.key && styles.tabBtnActive,
            ]}
            onPress={() => setActiveTab(tab.key)}
          >
            <MaterialIcons
              name={tab.icon as any}
              size={14}
              color={
                activeTab === tab.key
                  ? theme.colors.accentGold
                  : "rgba(255,255,255,0.4)"
              }
            />
            <Text
              style={[
                styles.tabText,
                activeTab === tab.key && styles.tabTextActive,
              ]}
            >
              {tab.label}
              <Text style={styles.tabCount}>
                {" "}
                ({getCluesForDirection(tab.key).length})
              </Text>
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollArea}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        {currentClues.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No clues in this direction</Text>
          </View>
        ) : (
          currentClues.map((clue) => (
            <ClueItem
              key={clue.id}
              clue={clue}
              isActive={clue.id === activeClueId}
              onPress={() => handleCluePress(clue)}
            />
          ))
        )}
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={[styles.actionBtn, checksRemaining === 0 && { opacity: 0.5 }]}
          disabled={checksRemaining === 0}
          onPress={() => {
            if (checksRemaining > 0) {
              checkAnswers();
              decrementCheck();
            }
          }}
        >
          <MaterialIcons
            name="check-circle"
            size={24}
            color="rgba(255,255,255,0.5)"
          />
          <Text style={styles.actionBtnText}>CHECK ({checksRemaining})</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionBtnPrimary,
            !isGridCompletelyFilled() && { opacity: 0.5 },
          ]}
          disabled={!isGridCompletelyFilled()}
          onPress={() => {
            const isFinished = checkCompletion();
            // If they are wrong, punish them by using a check attempt and showing where they failed
            if (!isFinished && checksRemaining > 0) {
              checkAnswers();
              decrementCheck();
            }
          }}
        >
          <MaterialIcons
            name="flag"
            size={24}
            color={theme.colors.accentGold}
          />
          <Text style={styles.actionBtnTextPrimary}>FINISH</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn}>
          <MaterialIcons
            name="backspace"
            size={24}
            color="rgba(255,255,255,0.5)"
          />
          <Text style={styles.actionBtnText}>CLEAR</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabsHeader: {
    flexDirection: "row",
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    gap: 3,
  },
  tabBtnActive: {
    borderBottomColor: theme.colors.accentGold,
  },
  tabText: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  tabTextActive: {
    color: "#fff",
  },
  tabCount: {
    fontSize: 10,
    color: "rgba(255,255,255,0.3)",
  },
  scrollArea: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  emptyState: {
    paddingVertical: 32,
    alignItems: "center",
  },
  emptyText: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 14,
    color: "rgba(255,255,255,0.3)",
  },
  itemRef: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    gap: 8,
    marginBottom: 2,
  },
  itemActive: {
    backgroundColor: "rgba(238, 205, 43, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(238, 205, 43, 0.1)",
  },
  itemNumber: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 14,
    color: "rgba(255,255,255,0.4)",
    minWidth: 24,
    marginTop: 2,
  },
  itemNumberActive: {
    color: theme.colors.accentGold,
  },
  itemText: {
    flex: 1,
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
    lineHeight: 22,
  },
  itemTextActive: {
    color: "#fff",
    fontWeight: "500",
  },
  actionBar: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionBtnPrimary: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(238, 205, 43, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(238, 205, 43, 0.2)",
  },
  actionBtnText: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 10,
    color: "rgba(255,255,255,0.5)",
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  actionBtnTextPrimary: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 10,
    color: theme.colors.accentGold,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
});
