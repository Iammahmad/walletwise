import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { FormField } from "@/src/components/FormField";
import { radius, spacing } from "@/src/design/tokens";
import { useTheme } from "@/src/design/ThemeProvider";

import {
  CATEGORY_COLORS,
  CATEGORY_ICONS,
  type CategoryColor,
  type CategoryIcon,
} from "./categoryOptions";

interface Props {
  name: string;
  icon: CategoryIcon;
  color: CategoryColor;
  nameLabel: string;
  namePlaceholder: string;
  nameError?: string;
  autoFocus?: boolean;
  onNameChange: (value: string) => void;
  onIconChange: (value: CategoryIcon) => void;
  onColorChange: (value: CategoryColor) => void;
}

export function CategoryAppearanceFields({
  name,
  icon,
  color,
  nameLabel,
  namePlaceholder,
  nameError,
  autoFocus,
  onNameChange,
  onIconChange,
  onColorChange,
}: Props) {
  const { colors } = useTheme();
  return (
    <>
      <FormField
        label={nameLabel}
        value={name}
        onChangeText={onNameChange}
        placeholder={namePlaceholder}
        autoCapitalize="words"
        autoFocus={autoFocus}
        maxLength={40}
        error={nameError}
      />
      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: colors.text }]}>Icon</Text>
        <View accessibilityRole="radiogroup" style={styles.optionGrid}>
          {CATEGORY_ICONS.map((item) => (
            <Pressable
              key={item}
              accessibilityRole="radio"
              accessibilityLabel={String(item)
                .replace(/-outline$/, "")
                .replace(/-/g, " ")}
              accessibilityState={{ checked: icon === item }}
              onPress={() => onIconChange(item)}
              style={[
                styles.iconOption,
                {
                  backgroundColor:
                    icon === item ? colors.primarySoft : colors.surface,
                  borderColor: icon === item ? colors.primary : colors.border,
                },
              ]}
            >
              <Ionicons
                name={item}
                size={24}
                color={icon === item ? colors.primary : colors.textMuted}
              />
            </Pressable>
          ))}
        </View>
      </View>
      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: colors.text }]}>Color</Text>
        <View accessibilityRole="radiogroup" style={styles.colorGrid}>
          {CATEGORY_COLORS.map((item) => (
            <Pressable
              key={item}
              accessibilityRole="radio"
              accessibilityLabel={`Category color ${item}`}
              accessibilityState={{ checked: color === item }}
              onPress={() => onColorChange(item)}
              style={[
                styles.colorOption,
                { backgroundColor: item },
                color === item && styles.colorSelected,
              ]}
            >
              {color === item ? (
                <Ionicons name="checkmark" size={22} color="#FFFFFF" />
              ) : null}
            </Pressable>
          ))}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  fieldGroup: { gap: spacing.xs },
  fieldLabel: { fontSize: 14, fontWeight: "600" },
  optionGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  iconOption: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  colorGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  colorOption: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  colorSelected: { borderWidth: 3, borderColor: "#FFFFFF", elevation: 3 },
});
