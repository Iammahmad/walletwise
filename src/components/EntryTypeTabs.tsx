import { Pressable, StyleSheet, Text, View } from "react-native";

import { radius } from "@/src/design/tokens";
import { useTheme } from "@/src/design/ThemeProvider";
import type { TransactionType } from "@/src/domain/types";

export type EntryType = TransactionType | "savings";

export function EntryTypeTabs({
  value,
  onChange,
  includeSavings = false,
}: {
  value: EntryType;
  onChange: (value: EntryType) => void;
  includeSavings?: boolean;
}) {
  const { colors } = useTheme();
  const options: EntryType[] = includeSavings
    ? ["expense", "income", "savings"]
    : ["expense", "income"];
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.tabs, { backgroundColor: colors.surface }]}
    >
      {options.map((item) => (
        <Pressable
          key={item}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === item }}
          onPress={() => onChange(item)}
          style={[
            styles.tab,
            value === item && { backgroundColor: colors.primarySoft },
          ]}
        >
          <Text
            style={[
              styles.label,
              { color: value === item ? colors.primary : colors.textMuted },
            ]}
          >
            {item[0]!.toUpperCase() + item.slice(1)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", gap: 4, padding: 4, borderRadius: radius.md },
  tab: {
    flex: 1,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
  },
  label: { fontSize: 13, fontWeight: "800" },
});
