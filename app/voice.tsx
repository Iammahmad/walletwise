import { Ionicons } from "@expo/vector-icons";
import * as Crypto from "expo-crypto";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  AppState,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Button } from "@/src/components/Button";
import { Card } from "@/src/components/Card";
import { Screen } from "@/src/components/Screen";
import { VoiceButton } from "@/src/components/VoiceButton";
import {
  findRecentTransaction,
  listAccounts,
  listBudgetCategories,
  listCategories,
  setTransactionDeleted,
} from "@/src/db/repository";
import { spacing } from "@/src/design/tokens";
import { useTheme } from "@/src/design/ThemeProvider";
import type { Transaction, VoiceDraft, VoiceState } from "@/src/domain/types";
import { parseVoiceCommand } from "@/src/domain/voiceParser";
import { parseWithCloudAi } from "@/src/services/ai";
import { normalizeError } from "@/src/services/errors";
import { isFirebaseFunctionsEnabled } from "@/src/services/firebase/config";
import {
  buildSpeechVocabulary,
  chooseAndroidRecognitionService,
  chooseSupportedSpeechLocale,
  selectBestTranscript,
} from "@/src/services/speechRecognition";
import { useAppStore } from "@/src/state/appStore";

const MAX_LISTENING_MS = 30_000;
const SILENCE_AFTER_RESULT_MS = 4_000;
const FINAL_RESULT_GRACE_MS = 2_000;
const START_TIMEOUT_MS = 7_000;
const LOCALE_LOOKUP_TIMEOUT_MS = 1_500;
const CLOUD_PARSE_TIMEOUT_MS = 12_000;

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export default function VoiceScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const profile = useAppStore((item) => item.profile)!;
  const online = useAppStore((item) => item.isOnline);
  const setVoiceReview = useAppStore((item) => item.setVoiceReview);
  const bump = useAppStore((item) => item.bumpDbRevision);
  const setLastDeleted = useAppStore(
    (item) => item.setLastDeletedTransactionId,
  );
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [message, setMessage] = useState(
    "Tap the microphone, then wait for “Listening” before speaking.",
  );
  const [candidates, setCandidates] = useState<Transaction[]>([]);

  const transcriptRef = useRef("");
  const vocabularyRef = useRef<string[]>([]);
  const cancelled = useRef(false);
  const interpreting = useRef(false);
  const recognitionActive = useRef(false);
  const stopRequested = useRef(false);
  const terminalError = useRef(false);
  const hardStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalResultTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(
    (timer: { current: ReturnType<typeof setTimeout> | null }) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    },
    [],
  );

  const clearRecognitionTimers = useCallback(() => {
    clearTimer(hardStopTimer);
    clearTimer(silenceTimer);
    clearTimer(finalResultTimer);
    clearTimer(startTimer);
  }, [clearTimer]);

  const openReview = useCallback(
    (drafts: VoiceDraft[], original: string) => {
      setVoiceReview(drafts, original);
      setState(
        drafts.some((draft) => draft.lowConfidenceFields.length)
          ? "needsClarification"
          : "readyForReview",
      );
      router.replace("/review");
    },
    [router, setVoiceReview],
  );

  const interpret = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean || interpreting.current || cancelled.current) return;
      interpreting.current = true;
      stopRequested.current = true;
      clearRecognitionTimers();
      setState("interpreting");
      setMessage("Interpreting your entry on this device…");
      try {
        const [accounts, categories, budgetCategories] = await Promise.all([
          listAccounts(),
          listCategories(),
          listBudgetCategories(),
        ]);
        const result = parseVoiceCommand(clean, {
          defaultCurrency: profile.defaultCurrency,
          locale: profile.locale,
          timezone: profile.timezone,
          accounts: accounts.map((item) => item.name),
          categories: categories.map((item) => item.name),
          budgetCategories: budgetCategories.map((item) => item.name),
          referenceTime: new Date(),
        });
        if (result.kind === "delete") {
          const matches = await findRecentTransaction(result.query);
          setCandidates(matches);
          setState("needsClarification");
          setMessage(
            matches.length
              ? matches.length === 1
                ? "Review the matching transaction before deleting it."
                : "Choose the transaction you meant."
              : "I could not find a matching recent transaction. Open Transactions to choose one.",
          );
          return;
        }
        if (result.kind === "transactions") {
          let drafts = result.drafts;
          if (
            result.missingFields.length &&
            profile.cloudAiEnabled &&
            isFirebaseFunctionsEnabled &&
            online
          ) {
            setMessage(
              "Local parsing needs help. Asking the protected cloud parser…",
            );
            try {
              const ai = await withTimeout(
                parseWithCloudAi({
                  transcript: clean,
                  locale: profile.locale,
                  timezone: profile.timezone,
                  defaultCurrency: profile.defaultCurrency,
                  accounts: accounts.map((item) => item.name),
                  categories: categories.map((item) => item.name),
                  budgetCategories: budgetCategories.map((item) => item.name),
                  referenceTime: new Date().toISOString(),
                }),
                CLOUD_PARSE_TIMEOUT_MS,
                "Cloud parsing timed out.",
              );
              drafts = ai.transactions.map((item, index) => {
                const local = drafts[index];
                const missing = ["amount", "category", "account"].filter(
                  (field) => !item[field as keyof typeof item],
                );
                return {
                  id: local?.id ?? Crypto.randomUUID(),
                  type: local?.type ?? item.type,
                  amount: local?.amount ?? item.amount,
                  currency:
                    local?.currency ?? item.currency ?? profile.defaultCurrency,
                  merchant: local?.merchant ?? item.merchant,
                  category: local?.category ?? item.category,
                  budget: local?.budget ?? item.budget,
                  account: local?.account ?? item.account,
                  occurredAt: local?.occurredAt ?? item.occurredAt,
                  note: local?.note ?? item.note,
                  confidence: Math.max(local?.confidence ?? 0, item.confidence),
                  lowConfidenceFields: missing,
                  originalTranscript: clean,
                };
              });
            } catch (error) {
              setMessage(
                `Cloud parsing was unavailable: ${normalizeError(error).message} You can complete the review manually.`,
              );
            }
          }
          openReview(drafts, clean);
          return;
        }
        openReview(
          [
            {
              id: Crypto.randomUUID(),
              type: "expense",
              amount: null,
              currency: profile.defaultCurrency,
              merchant: null,
              category: null,
              budget: null,
              account: null,
              occurredAt: new Date().toISOString(),
              note: null,
              confidence: 0.2,
              lowConfidenceFields: ["amount", "category", "account"],
              originalTranscript: clean,
            },
          ],
          clean,
        );
      } catch (error) {
        setState("error");
        setMessage(normalizeError(error).message);
      } finally {
        interpreting.current = false;
      }
    },
    [clearRecognitionTimers, online, openReview, profile],
  );

  const finishWithBestTranscript = useCallback(
    (value?: string) => {
      clearRecognitionTimers();
      if (cancelled.current || interpreting.current || terminalError.current)
        return;
      const clean = (value ?? transcriptRef.current).trim();
      if (clean) {
        void interpret(clean);
        return;
      }
      terminalError.current = true;
      setState("error");
      setMessage(
        "I did not hear any speech. Try again after “Listening” appears, or enter it manually.",
      );
    },
    [clearRecognitionTimers, interpret],
  );

  const requestStop = useCallback(() => {
    if (cancelled.current || interpreting.current || stopRequested.current)
      return;
    stopRequested.current = true;
    clearTimer(hardStopTimer);
    clearTimer(silenceTimer);
    clearTimer(startTimer);
    setState("processingTranscript");
    setMessage("Finishing the transcript…");

    finalResultTimer.current = setTimeout(() => {
      finalResultTimer.current = null;
      if (cancelled.current || interpreting.current || terminalError.current)
        return;
      const clean = transcriptRef.current.trim();
      if (clean) {
        void interpret(clean);
        ExpoSpeechRecognitionModule.abort();
      } else {
        recognitionActive.current = false;
        terminalError.current = true;
        setState("error");
        setMessage(
          "The recognizer did not return a transcript. Please try again or enter it manually.",
        );
        ExpoSpeechRecognitionModule.abort();
      }
    }, FINAL_RESULT_GRACE_MS);

    try {
      ExpoSpeechRecognitionModule.stop();
    } catch (error) {
      clearTimer(finalResultTimer);
      if (transcriptRef.current.trim()) finishWithBestTranscript();
      else {
        terminalError.current = true;
        setState("error");
        setMessage(normalizeError(error).message);
      }
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
      () => undefined,
    );
  }, [clearTimer, finishWithBestTranscript, interpret]);

  const scheduleSilenceStop = useCallback(() => {
    clearTimer(silenceTimer);
    silenceTimer.current = setTimeout(requestStop, SILENCE_AFTER_RESULT_MS);
  }, [clearTimer, requestStop]);

  useSpeechRecognitionEvent("start", () => {
    if (cancelled.current) {
      ExpoSpeechRecognitionModule.abort();
      return;
    }
    recognitionActive.current = true;
    clearTimer(startTimer);
    setState("listening");
    setMessage("Listening… Speak naturally.");
    hardStopTimer.current = setTimeout(requestStop, MAX_LISTENING_MS);
  });

  useSpeechRecognitionEvent("result", (event) => {
    const next = selectBestTranscript(event.results, vocabularyRef.current);
    if (next) {
      transcriptRef.current = next;
      setTranscript(next);
    }
    if (event.isFinal) {
      stopRequested.current = true;
      finishWithBestTranscript(next || undefined);
    } else if (next && recognitionActive.current && !stopRequested.current) {
      scheduleSilenceStop();
    }
  });

  useSpeechRecognitionEvent("nomatch", () => {
    if (cancelled.current || interpreting.current) return;
    if (transcriptRef.current.trim()) finishWithBestTranscript();
    else {
      terminalError.current = true;
      clearRecognitionTimers();
      setState("error");
      setMessage(
        "I could not recognize that. Try speaking closer to the microphone or enter it manually.",
      );
    }
  });

  useSpeechRecognitionEvent("error", (event) => {
    clearRecognitionTimers();
    recognitionActive.current = false;
    if (cancelled.current || interpreting.current || event.error === "aborted")
      return;
    if (stopRequested.current && transcriptRef.current.trim()) {
      finishWithBestTranscript();
      return;
    }
    terminalError.current = true;
    setState("error");
    setMessage(
      event.error === "not-allowed"
        ? "Microphone or speech permission was denied. Enable it in device Settings to use voice entry."
        : event.error === "no-speech" || event.error === "speech-timeout"
          ? "I did not hear any speech. Wait for “Listening”, then try again."
          : event.error === "language-not-supported"
            ? "This speech locale is not supported by your device. Change the locale in Settings or enter it manually."
            : `Speech recognition error: ${event.message}`,
    );
  });

  useSpeechRecognitionEvent("end", () => {
    recognitionActive.current = false;
    if (cancelled.current || interpreting.current || terminalError.current)
      return;
    finishWithBestTranscript();
  });

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next !== "active" && recognitionActive.current) {
        cancelled.current = true;
        clearRecognitionTimers();
        recognitionActive.current = false;
        ExpoSpeechRecognitionModule.abort();
        setState("idle");
        setMessage(
          "Voice entry stopped when WalletWise left the foreground. Tap to try again.",
        );
      }
    });
    return () => {
      subscription.remove();
      cancelled.current = true;
      clearRecognitionTimers();
      ExpoSpeechRecognitionModule.abort();
    };
  }, [clearRecognitionTimers]);

  const start = async () => {
    cancelled.current = false;
    interpreting.current = false;
    recognitionActive.current = false;
    stopRequested.current = false;
    terminalError.current = false;
    transcriptRef.current = "";
    vocabularyRef.current = [];
    clearRecognitionTimers();
    setTranscript("");
    setCandidates([]);

    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
      setState("error");
      setMessage(
        "Speech recognition is unavailable on this device. You can still add the entry manually.",
      );
      return;
    }
    setState("requestingPermission");
    setMessage("Preparing speech recognition…");
    try {
      const permission =
        await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        setState("error");
        setMessage(
          permission.restricted
            ? "Speech recognition is restricted by device settings."
            : "Permission was denied. Enable microphone and speech recognition in Settings.",
        );
        return;
      }
      if (cancelled.current) return;

      const [accounts, categories, budgetCategories] = await Promise.all([
        listAccounts(),
        listCategories(),
        listBudgetCategories(),
      ]);
      vocabularyRef.current = buildSpeechVocabulary(
        accounts.map((item) => item.name),
        [
          ...categories.map((item) => item.name),
          ...budgetCategories.map((item) => item.name),
        ],
        profile.defaultCurrency,
      );

      let androidRecognitionServicePackage: string | undefined;
      if (Platform.OS === "android") {
        const services =
          ExpoSpeechRecognitionModule.getSpeechRecognitionServices();
        androidRecognitionServicePackage = chooseAndroidRecognitionService(
          services,
          ExpoSpeechRecognitionModule.getDefaultRecognitionService()
            .packageName || undefined,
          online,
        );
      }

      let speechLocale = profile.locale.startsWith("en")
        ? profile.locale
        : "en-US";
      try {
        const supported = await withTimeout(
          ExpoSpeechRecognitionModule.getSupportedLocales({
            androidRecognitionServicePackage,
          }),
          LOCALE_LOOKUP_TIMEOUT_MS,
          "Locale lookup timed out.",
        );
        speechLocale = chooseSupportedSpeechLocale(
          speechLocale,
          supported.locales,
        );
      } catch {
        // Older Android recognizers cannot report supported locales; use the selected locale.
      }
      if (cancelled.current) return;

      setMessage("Starting the microphone… Speak when “Listening” appears.");
      startTimer.current = setTimeout(() => {
        if (recognitionActive.current || cancelled.current) return;
        terminalError.current = true;
        setState("error");
        setMessage(
          "The speech recognizer did not start. Check your device speech service and try again.",
        );
        ExpoSpeechRecognitionModule.abort();
      }, START_TIMEOUT_MS);
      ExpoSpeechRecognitionModule.start({
        lang: speechLocale,
        interimResults: true,
        continuous: false,
        maxAlternatives: 5,
        contextualStrings: vocabularyRef.current,
        requiresOnDeviceRecognition: false,
        addsPunctuation: true,
        recordingOptions: { persist: false },
        androidRecognitionServicePackage,
        androidIntentOptions: {
          EXTRA_LANGUAGE_MODEL: "free_form",
          EXTRA_MASK_OFFENSIVE_WORDS: false,
          EXTRA_PREFER_OFFLINE: !online,
        },
        iosTaskHint: "dictation",
      });
    } catch (error) {
      clearRecognitionTimers();
      terminalError.current = true;
      setState("error");
      setMessage(normalizeError(error).message);
    }
  };

  const cancel = () => {
    cancelled.current = true;
    clearRecognitionTimers();
    recognitionActive.current = false;
    ExpoSpeechRecognitionModule.abort();
    router.back();
  };

  const confirmDelete = (transaction: Transaction) =>
    Alert.alert(
      "Delete this transaction?",
      `${transaction.merchant || transaction.categoryName || "Transaction"} will be soft-deleted.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void setTransactionDeleted(transaction.id, true)
              .then(() => {
                setLastDeleted(transaction.id);
                bump();
                router.replace("/(tabs)/transactions");
              })
              .catch((error) => {
                setState("error");
                setMessage(normalizeError(error).message);
              });
          },
        },
      ],
    );

  const busy =
    state === "requestingPermission" ||
    state === "processingTranscript" ||
    state === "interpreting";
  const statusIcon =
    state === "error"
      ? "alert-circle-outline"
      : state === "listening"
        ? "radio-outline"
        : busy
          ? "hourglass-outline"
          : "mic-outline";

  return (
    <Screen scroll={false}>
      <View style={styles.content}>
        <View style={styles.status}>
          <Ionicons
            name={statusIcon}
            size={22}
            color={state === "error" ? colors.danger : colors.primary}
          />
          <Text
            accessibilityLiveRegion="polite"
            accessibilityRole="text"
            style={[styles.state, { color: colors.text }]}
          >
            {state.replace(/([A-Z])/g, " $1")}
          </Text>
        </View>
        <Card
          style={[
            styles.transcriptCard,
            state === "listening" && { borderColor: colors.primary },
          ]}
        >
          <Text style={[styles.transcriptLabel, { color: colors.textMuted }]}>
            {state === "listening"
              ? "Live transcript · may update"
              : "Transcript"}
          </Text>
          <Text
            style={[
              styles.transcript,
              { color: transcript ? colors.text : colors.textMuted },
            ]}
          >
            {transcript || message}
          </Text>
        </Card>
        {candidates.map((candidate) => (
          <Pressable
            key={candidate.id}
            accessibilityRole="button"
            onPress={() => confirmDelete(candidate)}
          >
            <Card>
              <Text style={[styles.candidateTitle, { color: colors.text }]}>
                {candidate.merchant || candidate.categoryName || "Transaction"}
              </Text>
              <Text style={{ color: colors.textMuted }}>
                Tap to review deletion · {candidate.categoryName}
              </Text>
            </Card>
          </Pressable>
        ))}
        <View style={styles.mic}>
          <VoiceButton
            state={state}
            onPress={state === "listening" ? requestStop : () => void start()}
            label={
              state === "error"
                ? "Try again"
                : busy
                  ? "Please wait"
                  : "Start listening"
            }
            disabled={busy}
          />
        </View>
        {state === "listening" || state === "processingTranscript" ? (
          <View style={styles.controls}>
            <Button label="Cancel" variant="secondary" onPress={cancel} />
            <Button
              label="Stop"
              icon="stop"
              onPress={requestStop}
              disabled={state !== "listening"}
            />
          </View>
        ) : (
          <Button label="Cancel" variant="ghost" onPress={cancel} />
        )}
        {state === "error" ? (
          <Button
            label="Enter manually"
            variant="secondary"
            onPress={() => router.replace("/(tabs)/add")}
          />
        ) : null}
        <Text style={[styles.privacy, { color: colors.textMuted }]}>
          Audio is processed by the selected device recognition service and is
          never saved by WalletWise.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: "center", gap: spacing.md },
  status: {
    flexDirection: "row",
    gap: spacing.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  state: { fontSize: 14, fontWeight: "700", textTransform: "capitalize" },
  transcriptCard: { minHeight: 180, justifyContent: "center", gap: spacing.sm },
  transcriptLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    fontWeight: "700",
  },
  transcript: { fontSize: 24, lineHeight: 33, fontWeight: "600" },
  candidateTitle: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  mic: { alignItems: "center" },
  controls: { flexDirection: "row", gap: spacing.sm },
  privacy: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    paddingHorizontal: spacing.lg,
  },
});
