import { MaterialIcons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "../../constants/theme";
import {
  formatReminderTime,
  REMINDER_MINUTE_STEP,
  stepHour,
  stepMinute,
} from "../../utils/reminderTime";

interface ReminderTimeModalProps {
  visible: boolean;
  hour: number;
  minute: number;
  onClose: () => void;
  onSave: (hour: number, minute: number) => void;
}

/**
 * Picks the local time for the daily reminder, which used to be fixed at
 * 19:00.
 *
 * Steppers rather than a native picker: the community date-time picker is a
 * native module, and adding one means a new binary for a single setting.
 * Nothing is saved until the player taps Save, so backing out leaves the
 * scheduled reminder untouched.
 */
export function ReminderTimeModal({
  visible,
  hour,
  minute,
  onClose,
  onSave,
}: ReminderTimeModalProps) {
  const insets = useSafeAreaInsets();
  const [draftHour, setDraftHour] = useState(hour);
  const [draftMinute, setDraftMinute] = useState(minute);

  // Each opening starts from what is saved, not from an abandoned draft.
  useEffect(() => {
    if (visible) {
      setDraftHour(hour);
      setDraftMinute(minute);
    }
  }, [visible, hour, minute]);

  const time = formatReminderTime(draftHour, draftMinute);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close without saving"
      />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
        <Text style={styles.title}>Daily reminder</Text>
        <Text style={styles.subtitle}>When should we tell you the new puzzles are in?</Text>

        <Text
          style={styles.time}
          accessibilityLiveRegion="polite"
          accessibilityLabel={`Reminder at ${time}`}
        >
          {time}
        </Text>

        <Stepper
          label="Hour"
          onDown={() => setDraftHour((h) => stepHour(h, -1))}
          onUp={() => setDraftHour((h) => stepHour(h, 1))}
        />
        <Stepper
          label="Minutes"
          hint={`${REMINDER_MINUTE_STEP}-minute steps`}
          onDown={() => setDraftMinute((m) => stepMinute(m, -1))}
          onUp={() => setDraftMinute((m) => stepMinute(m, 1))}
        />

        <TouchableOpacity
          style={styles.saveBtn}
          onPress={() => onSave(draftHour, draftMinute)}
          accessibilityRole="button"
          accessibilityLabel={`Save reminder time, ${time}`}
        >
          <Text style={styles.saveText}>SAVE</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

function Stepper({
  label,
  hint,
  onDown,
  onUp,
}: {
  label: string;
  hint?: string;
  onDown: () => void;
  onUp: () => void;
}) {
  return (
    <View style={styles.stepperRow}>
      <View>
        <Text style={styles.stepperLabel}>{label}</Text>
        {hint ? <Text style={styles.stepperHint}>{hint}</Text> : null}
      </View>
      <View style={styles.stepperButtons}>
        <TouchableOpacity
          style={styles.stepBtn}
          onPress={onDown}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Earlier ${label.toLowerCase()}`}
        >
          <MaterialIcons name="remove" size={22} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.stepBtn}
          onPress={onUp}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Later ${label.toLowerCase()}`}
        >
          <MaterialIcons name="add" size={22} color={theme.colors.textPrimary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    backgroundColor: theme.colors.bgSecondary,
    borderTopLeftRadius: theme.borderRadius.modal,
    borderTopRightRadius: theme.borderRadius.modal,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  title: {
    fontFamily: theme.typography.heading.fontFamily,
    fontSize: 20,
    color: theme.colors.textPrimary,
  },
  subtitle: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  time: {
    fontFamily: theme.typography.display.fontFamily,
    fontSize: 44,
    color: theme.colors.accentGold,
    textAlign: "center",
    marginVertical: 24,
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  stepperLabel: {
    fontFamily: theme.typography.subheading.fontFamily,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  stepperHint: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  stepperButtons: { flexDirection: "row", gap: 12 },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.bgTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtn: {
    marginTop: 24,
    backgroundColor: theme.colors.accentGold,
    borderRadius: theme.borderRadius.button,
    paddingVertical: 16,
    alignItems: "center",
  },
  saveText: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 14,
    letterSpacing: 1.5,
    color: "#000",
  },
});
