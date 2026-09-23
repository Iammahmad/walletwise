import { createHash, randomBytes, randomUUID } from "node:crypto";

import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  defineInt,
  defineSecret,
  defineString,
} from "firebase-functions/params";
import { z } from "zod";

initializeApp();
const db = getFirestore();
const region = "asia-south1";
const geminiApiKey = defineSecret("GEMINI_API_KEY");
const geminiModel = defineString("GEMINI_MODEL", {
  default: "gemini-2.5-flash-lite",
});
const aiRateLimit = defineInt("AI_RATE_LIMIT_PER_HOUR", { default: 30 });

const requireUser = (auth: { uid: string } | undefined) => {
  if (!auth?.uid)
    throw new HttpsError("unauthenticated", "Sign in to continue.");
  return auth.uid;
};

const asIsoNow = () => new Date().toISOString();
const pairId = (left: string, right: string) => [left, right].sort().join("_");

const participantSchema = z.object({
  remote_user_id: z.string().max(128).nullable(),
  display_name: z.string().trim().min(1).max(80),
  is_owner: z.boolean(),
  share_minor: z.number().int().nonnegative(),
  paid_minor: z.number().int().nonnegative(),
});

const splitSchema = z
  .object({
    id: z.string().uuid(),
    user_id: z.string().max(128).nullable(),
    created_by_user_id: z.string().max(128).nullable(),
    description: z.string().trim().min(1).max(160),
    split_type: z.enum(["equal", "loan"]),
    loan_direction: z.enum(["lent", "borrowed"]).nullable(),
    total_minor: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    currency: z.string().regex(/^[A-Z]{3}$/),
    occurred_at: z.string().datetime({ offset: true }),
    status: z.enum(["open", "settled"]),
    note: z.string().max(500).nullable(),
    created_at: z.string().datetime({ offset: true }),
    updated_at: z.string().datetime({ offset: true }),
    deleted_at: z.string().datetime({ offset: true }).nullable(),
    participants: z.array(participantSchema).min(2).max(50),
  })
  .superRefine((value, context) => {
    if (value.participants.filter((item) => item.is_owner).length !== 1) {
      context.addIssue({
        code: "custom",
        path: ["participants"],
        message: "Exactly one owner is required.",
      });
    }
    const shares = value.participants.reduce(
      (sum, item) => sum + item.share_minor,
      0,
    );
    const payments = value.participants.reduce(
      (sum, item) => sum + item.paid_minor,
      0,
    );
    if (shares !== value.total_minor || payments !== value.total_minor) {
      context.addIssue({
        code: "custom",
        path: ["participants"],
        message: "Split totals do not balance.",
      });
    }
  });

async function displayNameFor(uid: string): Promise<string> {
  const user = await getAuth().getUser(uid);
  return (
    user.displayName?.trim() ||
    user.email?.split("@")[0] ||
    "A WalletWise friend"
  );
}

async function sendExpoNotifications(
  userIds: string[],
  message: { title: string; body: string; data: Record<string, string> },
): Promise<void> {
  const unique = [...new Set(userIds)].slice(0, 50);
  if (!unique.length) return;
  const snapshots = await Promise.all(
    unique.map((uid) =>
      db.collection("users").doc(uid).collection("pushTokens").get(),
    ),
  );
  const tokens = [
    ...new Set(
      snapshots
        .flatMap((snapshot) => snapshot.docs.map((item) => item.data().token))
        .filter((token): token is string => typeof token === "string"),
    ),
  ];
  if (!tokens.length) return;
  const batches = Array.from(
    { length: Math.ceil(tokens.length / 100) },
    (_, index) => tokens.slice(index * 100, index * 100 + 100),
  );
  await Promise.all(
    batches.map(async (batch) => {
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
        },
        body: JSON.stringify(
          batch.map((to) => ({
            to,
            channelId: "splits",
            sound: "default",
            ...message,
          })),
        ),
      });
      if (!response.ok)
        console.error(
          JSON.stringify({ event: "push_failed", status: response.status }),
        );
    }),
  );
}

export const registerPushToken = onCall({ region }, async (request) => {
  const uid = requireUser(request.auth);
  const input = z
    .object({
      token: z.string().regex(/^(Exponent|Expo)PushToken\[[A-Za-z0-9_-]+\]$/),
      platform: z.enum(["android", "ios"]),
    })
    .parse(request.data);
  const id = createHash("sha256")
    .update(input.token)
    .digest("hex")
    .slice(0, 32);
  await db.collection("users").doc(uid).collection("pushTokens").doc(id).set({
    user_id: uid,
    token: input.token,
    platform: input.platform,
    updated_at: asIsoNow(),
  });
  return { registered: true };
});

export const createConnectionInvite = onCall({ region }, async (request) => {
  const uid = requireUser(request.auth);
  const token = randomBytes(24).toString("base64url");
  await db
    .collection("connectionInvites")
    .doc(token)
    .set({
      creator_uid: uid,
      status: "pending",
      created_at: FieldValue.serverTimestamp(),
      expires_at: Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
  return { token };
});

export const acceptConnectionInvite = onCall({ region }, async (request) => {
  const uid = requireUser(request.auth);
  const { token } = z
    .object({ token: z.string().regex(/^[A-Za-z0-9_-]{24,128}$/) })
    .parse(request.data);
  const inviteRef = db.collection("connectionInvites").doc(token);
  const result = await db.runTransaction(async (transaction) => {
    const invite = await transaction.get(inviteRef);
    if (!invite.exists)
      throw new HttpsError("not-found", "This invitation no longer exists.");
    const data = invite.data()!;
    if (data.status !== "pending" || data.expires_at.toMillis() <= Date.now()) {
      throw new HttpsError(
        "failed-precondition",
        "This invitation has expired or was already used.",
      );
    }
    const creatorUid = String(data.creator_uid);
    if (creatorUid === uid)
      throw new HttpsError(
        "invalid-argument",
        "You cannot accept your own invitation.",
      );
    const [creator, accepter] = await Promise.all([
      getAuth().getUser(creatorUid),
      getAuth().getUser(uid),
    ]);
    const now = asIsoNow();
    const creatorContactId = randomUUID();
    const accepterContactId = randomUUID();
    transaction.set(db.collection("connections").doc(pairId(creatorUid, uid)), {
      participant_uids: [creatorUid, uid],
      created_at: now,
      updated_at: now,
    });
    transaction.set(
      db
        .collection("users")
        .doc(creatorUid)
        .collection("splitContacts")
        .doc(creatorContactId),
      {
        id: creatorContactId,
        user_id: creatorUid,
        remote_user_id: uid,
        display_name:
          accepter.displayName ||
          accepter.email?.split("@")[0] ||
          "WalletWise friend",
        email: accepter.email ?? null,
        status: "connected",
        invite_token: null,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      },
    );
    transaction.set(
      db
        .collection("users")
        .doc(uid)
        .collection("splitContacts")
        .doc(accepterContactId),
      {
        id: accepterContactId,
        user_id: uid,
        remote_user_id: creatorUid,
        display_name:
          creator.displayName ||
          creator.email?.split("@")[0] ||
          "WalletWise friend",
        email: creator.email ?? null,
        status: "connected",
        invite_token: null,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      },
    );
    transaction.update(inviteRef, {
      status: "accepted",
      accepted_by: uid,
      accepted_at: FieldValue.serverTimestamp(),
    });
    return {
      creatorUid,
      contactId: accepterContactId,
      displayName:
        creator.displayName ||
        creator.email?.split("@")[0] ||
        "WalletWise friend",
      email: creator.email ?? null,
    };
  });
  await sendExpoNotifications([result.creatorUid], {
    title: "You’re connected on WalletWise",
    body: "A friend accepted your split invitation.",
    data: { screen: "splits" },
  });
  return {
    contactId: result.contactId,
    remoteUserId: result.creatorUid,
    displayName: result.displayName,
    email: result.email,
  };
});

export const upsertSplit = onCall({ region }, async (request) => {
  const uid = requireUser(request.auth);
  const input = splitSchema.parse(request.data);
  const participants = input.participants.map((item) => ({
    remote_user_id: item.is_owner ? uid : item.remote_user_id,
    display_name: item.display_name,
    share_minor: item.share_minor,
    paid_minor: item.paid_minor,
  }));
  const remoteUids = [
    ...new Set(
      participants
        .map((item) => item.remote_user_id)
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const otherUids = remoteUids.filter((remoteUid) => remoteUid !== uid);
  const connections = await Promise.all(
    otherUids.map((remoteUid) =>
      db.collection("connections").doc(pairId(uid, remoteUid)).get(),
    ),
  );
  if (connections.some((connection) => !connection.exists)) {
    throw new HttpsError(
      "permission-denied",
      "Every online participant must be a connected WalletWise friend.",
    );
  }
  const splitRef = db.collection("splits").doc(input.id);
  const existing = await splitRef.get();
  if (!existing.exists && input.deleted_at) return { saved: false };
  if (existing.exists) {
    const data = existing.data()!;
    if (
      !Array.isArray(data.participant_uids) ||
      !data.participant_uids.includes(uid)
    ) {
      throw new HttpsError(
        "permission-denied",
        "You are not a participant in this split.",
      );
    }
    if (data.created_by_user_id !== uid) {
      throw new HttpsError(
        "permission-denied",
        "Only the split creator can edit this shared entry.",
      );
    }
    if (
      typeof data.updated_at === "string" &&
      data.updated_at > input.updated_at
    )
      return { saved: false };
  }
  await splitRef.set(
    {
      id: input.id,
      created_by_user_id: existing.data()?.created_by_user_id ?? uid,
      description: input.description,
      split_type: input.split_type,
      loan_direction: input.loan_direction,
      total_minor: input.total_minor,
      currency: input.currency,
      occurred_at: input.occurred_at,
      status: input.status,
      note: input.note,
      created_at: input.created_at,
      updated_at: input.updated_at,
      deleted_at: input.deleted_at,
      participant_uids: remoteUids,
      participants,
    },
    { merge: true },
  );
  if (!existing.exists) {
    const creatorName = await displayNameFor(uid);
    await sendExpoNotifications(
      remoteUids.filter((item) => item !== uid),
      {
        title: `New split from ${creatorName}`,
        body: "You were added to a shared expense. Open WalletWise to review it.",
        data: { screen: "split", splitId: input.id },
      },
    );
  }
  return { saved: true };
});

const aiRequestSchema = z.object({
  transcript: z.string().trim().min(1).max(2000),
  locale: z.string().min(2).max(35),
  timezone: z.string().min(1).max(80),
  defaultCurrency: z.string().regex(/^[A-Z]{3}$/),
  accounts: z.array(z.string().min(1).max(80)).max(50),
  categories: z.array(z.string().min(1).max(80)).max(100),
  budgetCategories: z.array(z.string().min(1).max(80)).max(100),
  referenceTime: z.string().datetime({ offset: true }),
});
const aiTransactionSchema = z.object({
  type: z.enum(["expense", "income"]),
  amount: z
    .string()
    .regex(/^\d+(?:\.\d+)?$/)
    .nullable(),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .nullable(),
  merchant: z.string().max(160).nullable(),
  category: z.string().max(160).nullable(),
  budget: z.string().max(160).nullable(),
  account: z.string().max(160).nullable(),
  occurredAt: z.string().datetime({ offset: true }).nullable(),
  note: z.string().max(500).nullable(),
  confidence: z.number().min(0).max(1),
});
const aiOutputSchema = z.object({
  transactions: z.array(aiTransactionSchema).min(1).max(10),
  missingFields: z.array(z.string().min(1).max(40)).max(30),
  needsConfirmation: z.literal(true),
});

const nullableStringJsonSchema = {
  anyOf: [{ type: "string" }, { type: "null" }],
};
const aiOutputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    transactions: {
      type: "array",
      minItems: 1,
      maxItems: 10,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: { type: "string", enum: ["expense", "income"] },
          amount: nullableStringJsonSchema,
          currency: nullableStringJsonSchema,
          merchant: nullableStringJsonSchema,
          category: nullableStringJsonSchema,
          budget: nullableStringJsonSchema,
          account: nullableStringJsonSchema,
          occurredAt: nullableStringJsonSchema,
          note: nullableStringJsonSchema,
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
        required: [
          "type",
          "amount",
          "currency",
          "merchant",
          "category",
          "budget",
          "account",
          "occurredAt",
          "note",
          "confidence",
        ],
      },
    },
    missingFields: {
      type: "array",
      maxItems: 30,
      items: { type: "string" },
    },
    needsConfirmation: { type: "boolean", enum: [true] },
  },
  required: ["transactions", "missingFields", "needsConfirmation"],
};

export const parseTranscript = onCall(
  { region, secrets: [geminiApiKey], timeoutSeconds: 20 },
  async (request) => {
    const uid = requireUser(request.auth);
    const input = aiRequestSchema.parse(request.data);
    const hour = new Date().toISOString().slice(0, 13);
    const rateRef = db
      .collection("users")
      .doc(uid)
      .collection("rateLimits")
      .doc(`ai-${hour}`);
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(rateRef);
      const count = Number(snapshot.data()?.count ?? 0);
      if (count >= Math.min(Math.max(aiRateLimit.value(), 1), 100))
        throw new HttpsError(
          "resource-exhausted",
          "Cloud AI rate limit reached. Try again later.",
        );
      transaction.set(
        rateRef,
        { count: count + 1, updated_at: FieldValue.serverTimestamp() },
        { merge: true },
      );
    });
    const prompt = `You parse English personal-finance voice commands into JSON.
Never invent amounts, dates, merchants, currencies, accounts, or categories. Unknown values must be null.
Use only these accounts: ${JSON.stringify(input.accounts)}.
Use only these categories: ${JSON.stringify(input.categories)}.
Use only these budget categories: ${JSON.stringify(input.budgetCategories)}.
If no budget is explicitly mentioned, return budget null. Default currency: ${input.defaultCurrency}.
Locale: ${input.locale}. Timezone: ${input.timezone}. Reference time: ${input.referenceTime}.
Support multiple transactions. Return needsConfirmation true and no commentary.
Transcript: ${JSON.stringify(input.transcript)}`;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel.value())}:generateContent?key=${encodeURIComponent(geminiApiKey.value())}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0,
            responseMimeType: "application/json",
            responseJsonSchema: aiOutputJsonSchema,
          },
        }),
        signal: AbortSignal.timeout(12_000),
      },
    );
    if (!response.ok)
      throw new HttpsError(
        "unavailable",
        "The AI provider is temporarily unavailable.",
      );
    const provider = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = provider.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text)
      throw new HttpsError(
        "data-loss",
        "The AI provider returned an empty response.",
      );
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new HttpsError(
        "data-loss",
        "The AI provider returned invalid JSON.",
      );
    }
    return aiOutputSchema.parse(json);
  },
);

export const deleteAccount = onCall({ region }, async (request) => {
  const uid = requireUser(request.auth);
  z.object({ confirmation: z.literal("DELETE") }).parse(request.data);
  const [sharedSplits, connections, createdInvites, acceptedInvites] =
    await Promise.all([
      db
        .collection("splits")
        .where("participant_uids", "array-contains", uid)
        .get(),
      db
        .collection("connections")
        .where("participant_uids", "array-contains", uid)
        .get(),
      db.collection("connectionInvites").where("creator_uid", "==", uid).get(),
      db.collection("connectionInvites").where("accepted_by", "==", uid).get(),
    ]);
  await Promise.all(
    sharedSplits.docs.map(async (snapshot) => {
      const data = snapshot.data();
      if (data.created_by_user_id === uid) {
        await snapshot.ref.delete();
        return;
      }
      const participants = Array.isArray(data.participants)
        ? data.participants.map((participant: Record<string, unknown>) =>
            participant.remote_user_id === uid
              ? {
                  ...participant,
                  remote_user_id: null,
                  display_name: "Deleted WalletWise user",
                }
              : participant,
          )
        : [];
      const participantUids = Array.isArray(data.participant_uids)
        ? data.participant_uids.filter((value: unknown) => value !== uid)
        : [];
      await snapshot.ref.update({
        participants,
        participant_uids: participantUids,
        updated_at: asIsoNow(),
      });
    }),
  );
  const connectedUserIds = [
    ...new Set(
      connections.docs.flatMap((snapshot) => {
        const participantUids = snapshot.data().participant_uids;
        return Array.isArray(participantUids)
          ? participantUids.filter(
              (value): value is string =>
                typeof value === "string" && value !== uid,
            )
          : [];
      }),
    ),
  ];
  await Promise.all(
    connectedUserIds.map(async (otherUid) => {
      const contacts = await db
        .collection("users")
        .doc(otherUid)
        .collection("splitContacts")
        .where("remote_user_id", "==", uid)
        .get();
      await Promise.all(
        contacts.docs.map((contact) =>
          contact.ref.update({
            remote_user_id: null,
            display_name: "Deleted WalletWise user",
            email: null,
            status: "local",
            updated_at: asIsoNow(),
          }),
        ),
      );
    }),
  );
  const topLevelDocuments = [
    ...connections.docs,
    ...createdInvites.docs,
    ...acceptedInvites.docs,
  ];
  await Promise.all(topLevelDocuments.map((snapshot) => snapshot.ref.delete()));
  await db.recursiveDelete(db.collection("users").doc(uid));
  await getAuth().deleteUser(uid);
  return { deleted: true };
});
