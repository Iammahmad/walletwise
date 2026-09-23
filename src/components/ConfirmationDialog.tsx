import { Modal, StyleSheet, Text, View } from "react-native";

import { radius, spacing } from "@/src/design/tokens";
import { useTheme } from "@/src/design/ThemeProvider";
import { Button } from "./Button";

interface ConfirmationDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmationDialog({
  visible,
  title,
  message,
  confirmLabel = "Delete",
  loading = false,
  onCancel,
  onConfirm,
}: ConfirmationDialogProps) {
  const { colors } = useTheme();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View
        accessibilityViewIsModal
        style={[styles.overlay, { backgroundColor: colors.overlay }]}
      >
        <View
          style={[
            styles.dialog,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: colors.text }]}
          >
            {title}
          </Text>
          <Text style={[styles.message, { color: colors.textMuted }]}>
            {message}
          </Text>
          <View style={styles.actions}>
            <View style={styles.action}>
              <Button
                label="Cancel"
                variant="secondary"
                disabled={loading}
                onPress={onCancel}
              />
            </View>
            <View style={styles.action}>
              <Button
                label={confirmLabel}
                variant="danger"
                loading={loading}
                onPress={onConfirm}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  dialog: {
    width: "100%",
    maxWidth: 420,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: { fontSize: 21, fontWeight: "800" },
  message: { fontSize: 14, lineHeight: 21 },
  actions: { flexDirection: "row", gap: spacing.sm },
  action: { flex: 1 },
});
