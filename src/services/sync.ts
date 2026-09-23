import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  startAfter,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
  type QueryConstraint,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

import {
  getCloudPayload,
  getLastPulledAt,
  listOutbox,
  markOutboxFailure,
  markOutboxSuccess,
  mergeRemoteProfile,
  mergeRemoteRows,
  setLastPulledAt,
  type OutboxItem,
} from "@/src/db/repository";
import { mergeRemoteSplit } from "@/src/features/splits/cloudMerge";
import {
  getFirebaseAuth,
  getFirebaseFunctions,
  getFirestoreDb,
} from "./firebase/config";
import { normalizeError } from "./errors";

const PRIVATE_COLLECTIONS = [
  ["accounts", "accounts"],
  ["categories", "categories"],
  ["budget_categories", "budgetCategories"],
  ["transactions", "transactions"],
  ["budgets", "budgets"],
  ["savings", "savings"],
  ["split_contacts", "splitContacts"],
  ["split_settlements", "splitSettlements"],
] as const;
const PULL_PAGE_SIZE = 500;
let activeSync: Promise<void> | null = null;

function cloudCollection(entityType: OutboxItem["entityType"]): string {
  return (
    PRIVATE_COLLECTIONS.find(([local]) => local === entityType)?.[1] ??
    entityType
  );
}

async function push(userId: string): Promise<void> {
  const firestore = getFirestoreDb();
  const functions = getFirebaseFunctions();
  if (!firestore) return;
  const upsertSplit = functions
    ? httpsCallable<Record<string, unknown>, { saved: boolean }>(
        functions,
        "upsertSplit",
      )
    : null;
  for (const item of await listOutbox(userId)) {
    try {
      const payload = await getCloudPayload(item.entityType, item.entityId);
      if (!payload) {
        await markOutboxSuccess(item);
        continue;
      }
      if (item.entityType === "splits") {
        // Shared split writes require trusted validation. In free mode they
        // remain queued locally while all private ledger writes keep syncing.
        if (!upsertSplit) continue;
        await upsertSplit(payload);
        await markOutboxSuccess(item);
        continue;
      }
      const reference =
        item.entityType === "profiles"
          ? doc(firestore, "users", userId)
          : doc(
              firestore,
              "users",
              userId,
              cloudCollection(item.entityType),
              item.entityId,
            );
      const remote = await getDoc(reference);
      const remoteUpdatedAt = remote.data()?.updated_at;
      if (
        typeof remoteUpdatedAt === "string" &&
        typeof payload.updated_at === "string" &&
        remoteUpdatedAt >= payload.updated_at
      ) {
        await markOutboxSuccess(item);
        continue;
      }
      await setDoc(reference, payload, { merge: true });
      await markOutboxSuccess(item);
    } catch (error) {
      await markOutboxFailure(item, normalizeError(error).code);
    }
  }
}

async function pullPrivateCollection(
  userId: string,
  localName: Exclude<OutboxItem["entityType"], "profiles" | "splits">,
  remoteName: string,
): Promise<void> {
  const firestore = getFirestoreDb();
  if (!firestore) return;
  const lastPulledAt = await getLastPulledAt(userId, localName);
  const pullStartedAt = new Date().toISOString();
  let cursor: QueryDocumentSnapshot<DocumentData> | null = null;
  while (true) {
    const constraints: QueryConstraint[] = [
      where("updated_at", ">", lastPulledAt),
      where("updated_at", "<=", pullStartedAt),
      orderBy("updated_at", "asc"),
      orderBy(documentId(), "asc"),
    ];
    if (cursor) constraints.push(startAfter(cursor));
    constraints.push(limit(PULL_PAGE_SIZE));
    const snapshot = await getDocs(
      query(collection(firestore, "users", userId, remoteName), ...constraints),
    );
    const rows = snapshot.docs.map(
      (item) => item.data() as Record<string, string | number | boolean | null>,
    );
    await mergeRemoteRows(localName, rows);
    if (snapshot.size < PULL_PAGE_SIZE) break;
    cursor = snapshot.docs.at(-1) ?? null;
  }
  await setLastPulledAt(userId, localName, pullStartedAt);
}

async function pullSharedSplits(userId: string): Promise<void> {
  const firestore = getFirestoreDb();
  if (!firestore) return;
  const lastPulledAt = await getLastPulledAt(userId, "splits");
  const pullStartedAt = new Date().toISOString();
  const snapshot = await getDocs(
    query(
      collection(firestore, "splits"),
      where("participant_uids", "array-contains", userId),
      where("updated_at", ">", lastPulledAt),
      where("updated_at", "<=", pullStartedAt),
      orderBy("updated_at", "asc"),
      limit(PULL_PAGE_SIZE),
    ),
  );
  for (const item of snapshot.docs) await mergeRemoteSplit(item.data());
  await setLastPulledAt(userId, "splits", pullStartedAt);
}

async function pull(userId: string): Promise<void> {
  const firestore = getFirestoreDb();
  if (!firestore) return;
  const remoteProfile = await getDoc(doc(firestore, "users", userId));
  if (remoteProfile.exists()) {
    await mergeRemoteProfile(
      remoteProfile.data() as Record<string, string | number | boolean | null>,
    );
  }
  for (const [local, remote] of PRIVATE_COLLECTIONS) {
    if (local === "split_settlements") continue;
    await pullPrivateCollection(userId, local, remote);
  }
  await pullSharedSplits(userId);
  // Settlements may reference a shared split, so restore them only after the
  // parent split and its participant contacts are present locally.
  await pullPrivateCollection(userId, "split_settlements", "splitSettlements");
}

async function runSync(): Promise<void> {
  const user = getFirebaseAuth()?.currentUser;
  if (!user || !getFirestoreDb()) return;
  await push(user.uid);
  await pull(user.uid);
}

export function syncNow(): Promise<void> {
  if (!activeSync) {
    activeSync = runSync().finally(() => {
      activeSync = null;
    });
  }
  return activeSync;
}

export type { OutboxItem };
