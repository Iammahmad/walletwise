import { Ionicons } from "@expo/vector-icons";
import { useCallback, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/src/components/Button";
import { Card } from "@/src/components/Card";
import { FeedbackState } from "@/src/components/FeedbackState";
import { Screen } from "@/src/components/Screen";
import { createCategory, listCategories } from "@/src/db/repository";
import { radius, spacing } from "@/src/design/tokens";
import { useTheme } from "@/src/design/ThemeProvider";
import { categoryInputSchema } from "@/src/domain/schemas";
import type { Category, TransactionType } from "@/src/domain/types";
import { useReloadable } from "@/src/hooks/useReloadable";
import { normalizeError } from "@/src/services/errors";
import { useAppStore } from "@/src/state/appStore";

import { CategoryAppearanceFields } from "./CategoryAppearanceFields";
import { type CategoryColor, type CategoryIcon } from "./categoryOptions";

export default function CategoryManagementScreen() {
  const { colors } = useTheme();
  const bump = useAppStore((state) => state.bumpDbRevision);
  const loader = useCallback(() => listCategories(), []);
  const { data, loading, error, reload } = useReloadable<Category[]>(
    loader,
    [],
  );
  const [creating, setCreating] = useState(false);

  return (
    <Screen
      title="Transaction categories"
      subtitle="Organize expenses and income. A same-name budget matches expenses automatically; other budgets can be selected explicitly."
      action={
        <Button
          label="New"
          icon="add"
          variant="secondary"
          onPress={() => setCreating(true)}
        />
      }
    >
      <Card style={{ backgroundColor: colors.primarySoft }}>
        <Text style={[styles.helperTitle, { color: colors.primary }]}>
          Available everywhere
        </Text>
        <Text style={[styles.helperBody, { color: colors.text }]}>
          Custom categories appear in manual entry, filters, and voice review.
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
      ) : (
        <>
          <CategorySection
            title="Expense"
            categories={data.filter(
              (item) => item.transactionType === "expense",
            )}
          />
          <CategorySection
            title="Income"
            categories={data.filter(
              (item) => item.transactionType === "income",
            )}
          />
        </>
      )}
      {creating ? (
        <CategoryModal
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            bump();
          }}
        />
      ) : null}
    </Screen>
  );
}

function CategorySection({
  title,
  categories,
}: {
  title: string;
  categories: Category[];
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Text
        accessibilityRole="header"
        style={[styles.sectionTitle, { color: colors.textMuted }]}
      >
        {title}
      </Text>
      <Card style={styles.categoryCard}>
        {categories.map((category, index) => (
          <View
            key={category.id}
            accessible
            accessibilityLabel={`${category.name}, ${category.isDefault ? "default" : "custom"} ${title.toLowerCase()} category`}
            style={[
              styles.categoryRow,
              index > 0 && {
                borderTopColor: colors.border,
                borderTopWidth: StyleSheet.hairlineWidth,
              },
            ]}
          >
            <View
              style={[
                styles.categoryIcon,
                { backgroundColor: `${category.color}20` },
              ]}
            >
              <Ionicons
                name={category.icon as keyof typeof Ionicons.glyphMap}
                size={21}
                color={category.color}
              />
            </View>
            <Text style={[styles.categoryName, { color: colors.text }]}>
              {category.name}
            </Text>
            <Text style={[styles.categoryKind, { color: colors.textMuted }]}>
              {category.isDefault ? "Default" : "Custom"}
            </Text>
          </View>
        ))}
      </Card>
    </View>
  );
}

function CategoryModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const { colors } = useTheme();
  const [name, setName] = useState("");
  const [transactionType, setTransactionType] =
    useState<TransactionType>("expense");
  const [icon, setIcon] = useState<CategoryIcon>("paw-outline");
  const [color, setColor] = useState<CategoryColor>("#9A6BFF");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const parsed = categoryInputSchema.safeParse({
      name,
      transactionType,
      icon,
      color,
    });
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
      await createCategory(parsed.data);
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
        title="New category"
        subtitle="Give it a clear name so voice commands can recognize it."
      >
        <View
          accessibilityRole="radiogroup"
          style={[styles.segment, { backgroundColor: colors.surfaceMuted }]}
        >
          {(["expense", "income"] as const).map((type) => (
            <Pressable
              key={type}
              accessibilityRole="radio"
              accessibilityState={{ checked: transactionType === type }}
              onPress={() => setTransactionType(type)}
              style={[
                styles.segmentOption,
                transactionType === type && { backgroundColor: colors.surface },
              ]}
            >
              <Text
                style={[
                  styles.segmentLabel,
                  {
                    color:
                      transactionType === type ? colors.text : colors.textMuted,
                  },
                ]}
              >
                {type === "expense" ? "Expense" : "Income"}
              </Text>
            </Pressable>
          ))}
        </View>
        <CategoryAppearanceFields
          name={name}
          icon={icon}
          color={color}
          nameLabel="Category name"
          namePlaceholder="e.g. Pets"
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
          label="Create category"
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
  section: { gap: spacing.xs },
  sectionTitle: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    fontWeight: "700",
  },
  categoryCard: { paddingVertical: 0 },
  categoryRow: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryName: { flex: 1, fontSize: 15, fontWeight: "600" },
  categoryKind: { fontSize: 12 },
  segment: {
    flexDirection: "row",
    borderRadius: radius.md,
    padding: spacing.xxs,
  },
  segmentOption: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
  },
  segmentLabel: { fontSize: 15, fontWeight: "700" },
  error: { fontSize: 13, lineHeight: 18 },
});
