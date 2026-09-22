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
  listCategories,
  saveBudgetCategory,
} from "@/src/db/repository";
import { radius, spacing } from "@/src/design/tokens";
import { useTheme } from "@/src/design/ThemeProvider";
import { budgetCategoryInputSchema } from "@/src/domain/schemas";
import type { BudgetCategory, Category } from "@/src/domain/types";
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
  const loader = useCallback(async () => {
    const [budgetCategories, expenseCategories] = await Promise.all([
      listBudgetCategories(),
      listCategories("expense"),
    ]);
    return { budgetCategories, expenseCategories };
  }, []);
  const { data, loading, error, reload } = useReloadable<{
    budgetCategories: BudgetCategory[];
    expenseCategories: Category[];
  }>(loader, { budgetCategories: [], expenseCategories: [] });
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
      <Card style={{ backgroundColor: colors.primarySoft }}>
        <Text style={[styles.helperTitle, { color: colors.primary }]}>
          Flexible automatic budgets
        </Text>
        <Text style={[styles.helperBody, { color: colors.text }]}>
          Include one or more transaction categories in each budget. An
          automatic expense can count toward several budgets, such as Food and
          Household, without creating duplicate transactions.
        </Text>
      </Card>
      {loading ? (
        <FeedbackState kind="loading" />
      ) : error ? (
        <FeedbackState
          kind="error"
          message={error}
          actionLabel="Try again"
          onAction={() => void reload()}
        />
      ) : !data.budgetCategories.length ? (
        <FeedbackState
          kind="empty"
          title="No budget categories"
          message="Create one to start organizing monthly limits."
          actionLabel="Create a category"
          onAction={() => setEditing("new")}
        />
      ) : (
        <Card style={styles.listCard}>
          {data.budgetCategories.map((item, index) => (
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
                  {item.categoryNames.length
                    ? `Includes ${item.categoryNames.join(", ")}`
                    : "Only explicitly assigned expenses"}
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
          categories={data.expenseCategories}
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
  categories,
  onClose,
  onSaved,
}: {
  item: BudgetCategory | null;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { colors } = useTheme();
  const [name, setName] = useState(item?.name ?? "");
  const [icon, setIcon] = useState<CategoryIcon>(
    (item?.icon as CategoryIcon | undefined) ?? "pie-chart-outline",
  );
  const [color, setColor] = useState<CategoryColor>(
    (item?.color as CategoryColor | undefined) ?? "#087F5B",
  );
  const [categoryIds, setCategoryIds] = useState<string[]>(
    item?.categoryIds ?? [],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const candidate = {
      ...(item ? { id: item.id } : {}),
      name,
      icon,
      color,
      categoryIds,
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
      <Screen
        title={item ? "Edit budget category" : "New budget category"}
        subtitle="Choose which expense categories should count here automatically."
      >
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
        <View style={styles.categoryField}>
          <Text style={[styles.fieldLabel, { color: colors.text }]}>
            Included transaction categories
          </Text>
          <Text style={[styles.fieldHelp, { color: colors.textMuted }]}>
            Automatic expenses in every selected category count toward this
            budget. Leave all unchecked for an explicit-only budget.
          </Text>
          <Card style={styles.categoryPicker}>
            {categories.map((category, index) => {
              const selected = categoryIds.includes(category.id);
              return (
                <Pressable
                  key={category.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={`Include ${category.name}`}
                  onPress={() =>
                    setCategoryIds((current) =>
                      current.includes(category.id)
                        ? current.filter((id) => id !== category.id)
                        : [...current, category.id],
                    )
                  }
                  style={[
                    styles.categoryOption,
                    index > 0 && {
                      borderTopColor: colors.border,
                      borderTopWidth: StyleSheet.hairlineWidth,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.smallIcon,
                      { backgroundColor: `${category.color}20` },
                    ]}
                  >
                    <Ionicons
                      name={category.icon as keyof typeof Ionicons.glyphMap}
                      size={18}
                      color={category.color}
                    />
                  </View>
                  <Text style={[styles.categoryName, { color: colors.text }]}>
                    {category.name}
                  </Text>
                  <Ionicons
                    name={selected ? "checkbox" : "square-outline"}
                    size={24}
                    color={selected ? colors.primary : colors.textMuted}
                  />
                </Pressable>
              );
            })}
          </Card>
        </View>
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
  helperTitle: { fontSize: 15, fontWeight: "700" },
  helperBody: { fontSize: 13, lineHeight: 19, marginTop: spacing.xs },
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
  categoryField: { gap: spacing.xs },
  fieldLabel: { fontSize: 14, fontWeight: "600" },
  fieldHelp: { fontSize: 13, lineHeight: 18 },
  categoryPicker: { paddingVertical: 0 },
  categoryOption: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  smallIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryName: { flex: 1, fontSize: 15, fontWeight: "600" },
});
