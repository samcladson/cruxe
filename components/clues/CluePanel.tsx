import { MaterialIcons } from "@expo/vector-icons";
import React, { useRef } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { theme } from "../../constants/theme";
import { usePuzzleStore } from "../../stores/puzzleStore";
import { CrosswordClue, Direction } from "../../types/puzzle.types";
import { findClueId } from "../../utils/clueId";
import { hasPlayerInput } from "../../utils/hasPlayerInput";
import { checkOutcome } from "../../utils/checkOutcome";
import { SFX } from "../../services/soundService";

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

interface CluePanelProps {
  /** Whether the sheet holding this panel is raised over the grid. */
  expanded?: boolean;
  /** Toggles that. Omitted, the chevron is not rendered at all. */
  onToggleExpanded?: () => void;
  /** Fired when a clue is chosen, so the sheet can get out of the way. */
  onClueSelected?: () => void;
  /**
   * Combined height of the parts that stay on screen when collapsed: the
   * direction tabs and the action bar. The sheet rests at this height.
   */
  onChromeHeight?: (height: number) => void;
}

/**
 * CluePanel displays all clues organized by direction with 4 tabs:
 * Across, Down, Backwards, and Up.
 */
export function CluePanel({
  expanded = false,
  onToggleExpanded,
  onClueSelected,
  onChromeHeight,
}: CluePanelProps = {}) {
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
    clearWord,
  } = usePuzzleStore();
  const scrollViewRef = useRef<ScrollView>(null);

  // Tabs should operate independently of the board's selected direction.
  const [activeTab, setActiveTab] = React.useState<Direction>("across");

  // Measured rather than assumed: the sheet rests at exactly the height of
  // the controls that remain visible when the clue list is hidden.
  const [tabsHeight, setTabsHeight] = React.useState(0);
  const [actionsHeight, setActionsHeight] = React.useState(0);
  React.useEffect(() => {
    if (tabsHeight > 0 && actionsHeight > 0) {
      onChromeHeight?.(tabsHeight + actionsHeight);
    }
  }, [tabsHeight, actionsHeight, onChromeHeight]);

  if (!activePuzzle) return null;

  const getActiveClueId = () => {
    if (!selectedCell) return null;
    const currentCell = activePuzzle.grid[selectedCell.row][selectedCell.col];
    let targetId = findClueId(currentCell.clueIds, selectedDirection);
    if (!targetId && currentCell.clueIds.length > 0)
      targetId = currentCell.clueIds[0];
    return targetId;
  };

  const activeClueId = getActiveClueId();

  const handleCluePress = (clue: CrosswordClue) => {
    selectCell(clue.startRow, clue.startCol);
    usePuzzleStore.setState({ selectedDirection: clue.direction });
    // Picking a clue means you want to type it, so the raised sheet drops
    // back rather than sitting over the square you just chose.
    onClueSelected?.();
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

  // Checking an untouched grid only confirms the letters the puzzle came
  // with, and spends one of a limited number of checks to do it.
  const canCheck = checksRemaining > 0 && hasPlayerInput(activePuzzle.grid);

  // Render all tabs. If a tab has no clues, we will disable it.
  const availableTabs = DIRECTION_TABS;

  return (
    <View style={styles.container}>
      {/* Direction Tabs (Fixed, evenly spaced) */}
      <View
        style={styles.tabsHeader}
        onLayout={(e) => setTabsHeight(e.nativeEvent.layout.height)}
      >
        {availableTabs.map((tab) => {
          const isEmpty = getCluesForDirection(tab.key).length === 0;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tabBtn,
                activeTab === tab.key && styles.tabBtnActive,
                isEmpty && { opacity: 0.3 },
              ]}
              disabled={isEmpty}
              onPress={() => {
                setActiveTab(tab.key);
                usePuzzleStore.setState({ selectedDirection: tab.key });
              }}
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
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}

        {onToggleExpanded ? (
          <TouchableOpacity
            style={styles.expandBtn}
            onPress={onToggleExpanded}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={
              expanded ? "Collapse the clue list" : "Show all clues"
            }
          >
            <MaterialIcons
              name={expanded ? "keyboard-arrow-down" : "keyboard-arrow-up"}
              size={22}
              color={theme.colors.accentGold}
            />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Only while raised. Collapsed, the tabs and the action bar are the
          whole panel, and the space goes back to the grid. */}
      {expanded ? (
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
      ) : null}

      {/* Bottom Action Bar */}
      <View
        style={styles.actionBar}
        onLayout={(e) => setActionsHeight(e.nativeEvent.layout.height)}
      >
        <TouchableOpacity
          style={[styles.actionBtn, !canCheck && { opacity: 0.5 }]}
          disabled={!canCheck}
          accessibilityRole="button"
          accessibilityLabel={`Check answers, ${checksRemaining} remaining`}
          accessibilityState={{ disabled: !canCheck }}
          onPress={() => {
            if (canCheck) {
              checkAnswers();
              decrementCheck();
              const grid = usePuzzleStore.getState().activePuzzle?.grid;
              if (grid) SFX.checkResult(checkOutcome(grid));
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
            // Always pop the completion modal (calculate accuracy regardless of errors)
            usePuzzleStore.getState().forceCompletePuzzle();
          }}
        >
          <MaterialIcons
            name="flag"
            size={24}
            color={theme.colors.accentGold}
          />
          <Text style={styles.actionBtnTextPrimary}>FINISH</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, !selectedCell && { opacity: 0.5 }]}
          disabled={!selectedCell}
          onPress={() => {
            Alert.alert(
              "Clear Word",
              "Are you sure you want to clear this word? Prefilled hints will be kept.",
              [
                {
                  text: "Cancel",
                  style: "cancel",
                },
                {
                  text: "Clear",
                  style: "destructive",
                  onPress: () => clearWord(),
                },
              ],
            );
          }}
        >
          <MaterialIcons
            name="backspace"
            size={24}
            color={
              !selectedCell ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.5)"
            }
          />
          <Text
            style={[
              styles.actionBtnText,
              !selectedCell && { color: "rgba(255,255,255,0.2)" },
            ]}
          >
            CLEAR
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  expandBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  tabsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
    height: 44,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
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
