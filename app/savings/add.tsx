import { useRouter } from "expo-router";

import { Screen } from "@/src/components/Screen";
import { SavingForm } from "@/src/features/savings/SavingForm";
import { saveSaving } from "@/src/features/savings/repository";
import { useAppStore } from "@/src/state/appStore";

export default function AddSavingScreen() {
  const router = useRouter();
  const bump = useAppStore((state) => state.bumpDbRevision);
  return (
    <Screen
      title="Add savings"
      subtitle="Build the habit without changing your ledger."
    >
      <SavingForm
        onSubmit={async (input) => {
          await saveSaving(input);
          bump();
          router.replace("/savings");
        }}
      />
    </Screen>
  );
}
