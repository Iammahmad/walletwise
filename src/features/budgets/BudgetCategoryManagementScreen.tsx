import { Ionicons } from "@expo/vector-icons";
import { useCallback, useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/src/components/Button";
import { Card } from "@/src/components/Card";
import { FeedbackState } from "@/src/components/FeedbackState";
import { Screen } from "@/src/components/Screen";
import {
  deleteBudgetCategory,
  listBudgetCategories,
  saveBudgetCategory,
} from "@/src/db/repository";
import { radius, spacing } from "@/src/design/tokens";
import { useTheme } from "@/src/design/ThemeProvider";
import { budgetCategoryInputSchema } from "@/src/domain/schemas";
import type { BudgetCategory } from "@/src/domain/types";
import { CategoryAppearanceFields } from "@/src/features/categories/CategoryAppearanceFields";
import type {
  CategoryColor,
  CategoryIcon,
} from "@/src/features/categories/categoryOptions";
import { useReloadable } from "@/src/hooks/useReloadable";
import { normalizeError } from "@/src/services/errors";
import { useAppStore } from "@/src/state/appStore";

export default function BudgetCategoryManagementScreen() {
  const { colors } = useTheme();
  const bump = useAppStore((state) => state.bumpDbRevision);
  const loader = useCallback(() => listBudgetCategories(), []);
  const { data, loading, error, reload } = useReloadable<BudgetCategory[]>(
    loader,
    [],
  );
  const [editing, setEditing] = useState<BudgetCategory | "new" | null>(null);

  const remove = (item: BudgetCategory) => {
    Alert.alert(
      `Delete ${item.name}?`,
      "Existing transactions keep their history. This category will no longer be available for new budgets or entries.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void deleteBudgetCategory(item.id)
              .then(() => bump())
              .catch((caught) =>
                Alert.alert(
                  "Could not delete category",
                  normalizeError(caught).message,
                ),
              );
          },
        },
      ],
    );
  };

  return (
    <Screen
      title="Budget categories"
      subtitle="Set up the groups used for monthly limits. They can differ from transaction categories."
      action={
        <Button
          label="New"
          icon="add"
          variant="secondary"
          onPress={() => setEditing("new")}
        />
      }
    >
      {loading ? (
        <FeedbackState kind="loading" />
      ) : error ? (
        <FeedbackState
          kind="error"
          message={error}
          actionLabel="Try again"
          onAction={() => void reload()}
        />
      ) : !data.length ? (
        <FeedbackState
          kind="empty"
          title="No budget categories"
          message="Create one to start organizing monthly limits."
          actionLabel="Create a category"
          onAction={() => setEditing("new")}
        />
      ) : (
        <Card style={styles.listCard}>
          {data.map((item, index) => (
            <View
              key={item.id}
              style={[
                styles.row,
                index > 0 && {
                  borderTopColor: colors.border,
                  borderTopWidth: StyleSheet.hairlineWidth,
                },
              ]}
            >
              <View
                style={[styles.icon, { backgroundColor: `${item.color}20` }]}
              >
                <Ionicons
                  name={item.icon as keyof typeof Ionicons.glyphMap}
                  size={21}
                  color={item.color}
                />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Edit ${item.name}`}
                onPress={() => setEditing(item)}
                style={styles.rowText}
              >
                <Text style={[styles.name, { color: colors.text }]}>
                  {item.name}
                </Text>
                <Text style={[styles.mapping, { color: colors.textMuted }]}>
                  {item.sourceCategoryName &&
                  item.sourceCategoryName.toLocaleLowerCase() ===
                    item.name.toLocaleLowerCase()
                    ? `Automatic for ${item.sourceCategoryName}`
                    : "Explicit assignment or same-name category"}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Delete ${item.name}`}
                hitSlop={10}
                onPress={() => remove(item)}
                style={styles.action}
              >
                <Ionicons
                  name="trash-outline"
                  size={20}
                  color={colors.danger}
                />
              </Pressable>
            </View>
          ))}
        </Card>
      )}
      {editing ? (
        <BudgetCategoryModal
          item={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            bump();
          }}
        />
      ) : null}
    </Screen>
  );
}

function BudgetCategoryModal({
  item,
  onClose,
  onSaved,
}: {
  item: BudgetCategory | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { colors } = useTheme();
  const [name, setName] = useState(item?.name ?? "");
  const [icon, setIcon] = useState<CategoryIcon>(
    (item?.icon as CategoryIcon | undefined) ?? "pie-chart-outline",
  );
  const [color, setColor] = useState<CategoryColor>(
    (item?.color as CategoryColor | undefined) ?? "#9A6BFF",
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const candidate = {
      ...(item ? { id: item.id } : {}),
      name,
      icon,
      color,
    };
    const parsed = budgetCategoryInputSchema.safeParse(candidate);
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [
            String(issue.path[0]),
            issue.message,
          ]),
        ),
      );
      return;
    }
    setSaving(true);
    setErrors({});
    try {
      await saveBudgetCategory(parsed.data);
      onSaved();
    } catch (error) {
      setErrors({ form: normalizeError(error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <Screen title={item ? "Edit budget category" : "New budget category"}>
        <CategoryAppearanceFields
          name={name}
          icon={icon}
          color={color}
          nameLabel="Budget category name"
          namePlaceholder="e.g. Eating out"
          nameError={errors.name}
          autoFocus
          onNameChange={setName}
          onIconChange={setIcon}
          onColorChange={setColor}
        />
        {errors.form ? (
          <Text
            accessibilityRole="alert"
            style={[styles.error, { color: colors.danger }]}
          >
            {errors.form}
          </Text>
        ) : null}
        <Button
          label={item ? "Save changes" : "Create category"}
          onPress={() => void submit()}
          loading={saving}
        />
        <Button
          label="Cancel"
          variant="ghost"
          onPress={onClose}
          disabled={saving}
        />
      </Screen>
    </Modal>
  );
}

const styles = StyleSheet.create({
  listCard: { paddingVertical: 0 },
  row: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1, minHeight: 54, justifyContent: "center" },
  name: { fontSize: 15, fontWeight: "700" },
  mapping: { fontSize: 12, marginTop: 3 },
  action: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  error: { fontSize: 13, lineHeight: 18 },
});
