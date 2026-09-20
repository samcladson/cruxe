import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../../constants/theme";
import { submitFeedback } from "../../services/feedbackService";
import {
  FEEDBACK_MAX_LENGTH,
  FeedbackCategory,
} from "../../utils/feedbackInput";

interface FeedbackModalProps {
  visible: boolean;
  onClose: () => void;
}

const CATEGORIES: { key: FeedbackCategory; label: string }[] = [
  { key: "bug", label: "Bug" },
  { key: "idea", label: "Idea" },
  { key: "puzzle", label: "Puzzle" },
  { key: "other", label: "Other" },
];

/**
 * Collects a category and a message, and says plainly what is sent with it.
 *
 * The category costs one tap and is what makes the table sortable the moment
 * there is more than a handful of entries. Nothing here reads feedback back:
 * the table is insert-only from the client.
 */
export function FeedbackModal({ visible, onClose }: FeedbackModalProps) {
  const [category, setCategory] = useState<FeedbackCategory>("bug");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const reset = () => {
    setCategory("bug");
    setMessage("");
  };

  const send = async () => {
    setSending(true);
    try {
      const { error } = await submitFeedback(category, message);
      if (error) {
        Alert.alert("Couldn't send", error);
        return;
      }
      // Closing first would race the alert against the modal dismissal on
      // Android, and the thank-you would never be seen.
      Alert.alert("Thank you", "Your feedback has been sent.", [
        {
          text: "OK",
          onPress: () => {
            reset();
            onClose();
          },
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const remaining = FEEDBACK_MAX_LENGTH - message.trim().length;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.screen}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Send feedback</Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={10}
              disabled={sending}
              accessibilityRole="button"
              accessibilityLabel="Close feedback"
            >
              <MaterialIcons
                name="close"
                size={24}
                color={theme.colors.textMuted}
              />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.label}>What is it about?</Text>
            <View style={styles.chipRow}>
              {CATEGORIES.map((c) => {
                const selected = c.key === category;
                return (
                  <TouchableOpacity
                    key={c.key}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => setCategory(c.key)}
                    disabled={sending}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={c.label}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selected && styles.chipTextSelected,
                      ]}
                    >
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.label, { marginTop: 26 }]}>
              Tell us what happened
            </Text>
            <TextInput
              style={styles.input}
              value={message}
              onChangeText={setMessage}
              placeholder="The more detail the better."
              placeholderTextColor={theme.colors.textMuted}
              multiline
              textAlignVertical="top"
              maxLength={FEEDBACK_MAX_LENGTH}
              editable={!sending}
              accessibilityLabel="Your feedback"
            />
            <Text style={styles.counter}>
              {remaining < 200 ? `${remaining} characters left` : " "}
            </Text>

            <Text style={styles.note}>
              Sent with your app version and device so we can reproduce it. We
              may use your account to reply.
            </Text>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.sendBtn,
                (sending || message.trim() === "") && styles.sendBtnDisabled,
              ]}
              onPress={send}
              disabled={sending || message.trim() === ""}
              accessibilityRole="button"
              accessibilityLabel="Send feedback"
              accessibilityState={{ disabled: sending || message.trim() === "" }}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text style={styles.sendBtnText}>SEND</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.bgPrimary },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    fontFamily: theme.typography.heading.fontFamily,
    fontSize: 22,
    color: theme.colors.textPrimary,
  },
  content: { paddingHorizontal: 24, paddingBottom: 24 },
  label: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 11,
    letterSpacing: 1.8,
    fontWeight: "bold",
    color: theme.colors.textMuted,
    marginBottom: 12,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  chipSelected: {
    backgroundColor: "rgba(238, 205, 43, 0.14)",
    borderColor: theme.colors.accentGold,
  },
  chipText: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  chipTextSelected: { color: theme.colors.accentGold, fontWeight: "bold" },
  input: {
    minHeight: 150,
    backgroundColor: theme.colors.bgSecondary,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 14,
    padding: 16,
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.textPrimary,
  },
  counter: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: "right",
    marginTop: 6,
    minHeight: 16,
  },
  note: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.textMuted,
    marginTop: 14,
  },
  footer: { paddingHorizontal: 24, paddingBottom: 24, paddingTop: 8 },
  sendBtn: {
    backgroundColor: theme.colors.accentGold,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 16,
    ...theme.shadows.goldGlow,
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 16,
    color: "#000",
    fontWeight: "bold",
    letterSpacing: 1.5,
  },
});
