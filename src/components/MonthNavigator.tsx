import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { radius, spacing } from "@/src/design/tokens";
import { useTheme } from "@/src/design/ThemeProvider";
import { formatMonthStart, shiftMonthStart } from "@/src/domain/dates";

interface MonthNavigatorProps {
  monthStart: string;
  currentMonthStart: string;
  locale: string;
  onChange: (monthStart: string) => void;
}

export function MonthNavigator({
  monthStart,
  currentMonthStart,
  locale,
  onChange,
}: MonthNavigatorProps) {
  const { colors } = useTheme();
  const atCurrentMonth = monthStart >= currentMonthStart;
  const label = formatMonthStart(monthStart, locale);

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.navigator,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <MonthButton
          label="Previous month"
          icon="chevron-back"
          color={colors.text}
          onPress={() => onChange(shiftMonthStart(monthStart, -1))}
        />
        <Text
          accessibilityRole="header"
          accessibilityLiveRegion="polite"
          style={[styles.label, { color: colors.text }]}
        >
          {label}
        </Text>
        <MonthButton
          label="Next month"
          icon="chevron-forward"
          color={colors.text}
          disabled={atCurrentMonth}
          onPress={() => onChange(shiftMonthStart(monthStart, 1))}
        />
      </View>
      {!atCurrentMonth ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Return to current month"
          onPress={() => onChange(currentMonthStart)}
          style={({ pressed }) => [
            styles.currentButton,
            { opacity: pressed ? 0.65 : 1 },
          ]}
        >
          <Text style={[styles.currentLabel, { color: colors.primary }]}>
            Current month
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function MonthButton({
  label,
  icon,
  color,
  disabled = false,
  onPress,
}: {
  label: string;
  icon: "chevron-back" | "chevron-forward";
  color: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.arrow,
        { opacity: disabled ? 0.3 : pressed ? 0.6 : 1 },
      ]}
    >
      <Ionicons name={icon} size={24} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", gap: spacing.xs },
  navigator: {
    width: "100%",
    minHeight: 52,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
  },
  arrow: {
    width: 52,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700" },
  currentButton: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  currentLabel: { fontSize: 14, fontWeight: "700" },
});
