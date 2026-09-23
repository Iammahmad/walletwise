import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert } from "react-native";

import { Button } from "@/src/components/Button";
import { EntryTypeTabs, type EntryType } from "@/src/components/EntryTypeTabs";
import { FeedbackState } from "@/src/components/FeedbackState";
import { Screen } from "@/src/components/Screen";
import { TransactionForm } from "@/src/components/TransactionForm";
import {
  getTransaction,
  saveTransaction,
  setTransactionDeleted,
} from "@/src/db/repository";
import type { Transaction } from "@/src/domain/types";
import { useReloadable } from "@/src/hooks/useReloadable";
import { normalizeError } from "@/src/services/errors";
import { useAppStore } from "@/src/state/appStore";

export default function EditTransactionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const bump = useAppStore((state) => state.bumpDbRevision);
  const setDeleted = useAppStore((state) => state.setLastDeletedTransactionId);
  const loader = useCallback(() => getTransaction(params.id), [params.id]);
  const { data, loading, error, reload } = useReloadable<Transaction | null>(
    loader,
    null,
  );
  const remove = () =>
    Alert.alert(
      "Delete transaction?",
      "This entry will be hidden locally and queued for cloud deletion. You can undo it from Transactions.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void setTransactionDeleted(params.id, true)
              .then(() => {
                setDeleted(params.id);
                bump();
                router.back();
              })
              .catch((caught) =>
                Alert.alert(
                  "Could not delete transaction",
                  normalizeError(caught).message,
                ),
              );
          },
        },
      ],
    );
  return (
    <Screen>
      {loading ? (
        <FeedbackState kind="loading" />
      ) : error ? (
        <FeedbackState
          kind="error"
          message={error}
          actionLabel="Try again"
          onAction={() => void reload()}
        />
      ) : !data ? (
        <FeedbackState kind="empty" title="Transaction not found" />
      ) : (
        <TransactionEditor
          transaction={data}
          onDelete={remove}
          onSaved={() => {
            bump();
            router.back();
          }}
        />
      )}
    </Screen>
  );
}

function TransactionEditor({
  transaction,
  onDelete,
  onSaved,
}: {
  transaction: Transaction;
  onDelete: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState<EntryType>(transaction.type);
  return (
    <>
      <EntryTypeTabs value={type} onChange={setType} />
      <TransactionForm
        key={`${transaction.id}-${type}`}
        initial={transaction}
        selectedType={type === "income" ? "income" : "expense"}
        submitLabel="Save changes"
        onSubmit={async (input) => {
          await saveTransaction(input);
          onSaved();
        }}
      />
      <Button
        label="Delete transaction"
        variant="danger"
        icon="trash-outline"
        onPress={onDelete}
      />
    </>
  );
}
