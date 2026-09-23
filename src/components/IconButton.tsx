import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet } from "react-native";

import { radius } from "@/src/design/tokens";
import { useTheme } from "@/src/design/ThemeProvider";

export function IconButton({
  icon,
  label,
  onPress,
  danger = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const { colors } = useTheme();
  const foreground = danger ? colors.danger : colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: danger ? colors.dangerSoft : colors.primarySoft,
          opacity: pressed ? 0.72 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={20} color={foreground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
});
