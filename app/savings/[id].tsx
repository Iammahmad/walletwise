import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback } from "react";
import { Alert } from "react-native";

import { Button } from "@/src/components/Button";
import { FeedbackState } from "@/src/components/FeedbackState";
import { Screen } from "@/src/components/Screen";
import { SavingForm } from "@/src/features/savings/SavingForm";
import {
  deleteSaving,
  getSaving,
  saveSaving,
} from "@/src/features/savings/repository";
import { useReloadable } from "@/src/hooks/useReloadable";
import { useAppStore } from "@/src/state/appStore";

export default function EditSavingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const bump = useAppStore((state) => state.bumpDbRevision);
  const loader = useCallback(async () => (id ? getSaving(id) : null), [id]);
  const { data, loading, error, reload } = useReloadable(loader, null);

  if (loading)
    return (
      <Screen>
        <FeedbackState kind="loading" />
      </Screen>
    );
  if (error || !data) {
    return (
      <Screen>
        <FeedbackState
          kind="error"
          message={error ?? "This savings entry could not be found."}
          actionLabel="Try again"
          onAction={() => void reload()}
        />
      </Screen>
    );
  }

  const remove = () =>
    Alert.alert(
      "Delete savings entry?",
      "This removes the tracked contribution. It does not change transactions or budgets.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            void deleteSaving(data.id)
              .then(() => {
                bump();
                router.replace("/savings");
              })
              .catch(() =>
                Alert.alert(
                  "Could not delete",
                  "The savings entry is still safely stored. Try again.",
                ),
              ),
        },
      ],
    );

  return (
    <Screen
      title="Edit savings"
      subtitle="Savings remain separate from your ledger."
    >
      <SavingForm
        preset={{
          id: data.id,
          name: data.name,
          amountMinor: data.amountMinor,
          currency: data.currency,
          occurredAt: data.occurredAt,
          note: data.note,
          source: data.source,
        }}
        submitLabel="Save changes"
        onSubmit={async (input) => {
          await saveSaving(input);
          bump();
          router.replace("/savings");
        }}
      />
      <Button
        label="Delete savings entry"
        variant="danger"
        icon="trash-outline"
        onPress={remove}
      />
    </Screen>
  );
}
