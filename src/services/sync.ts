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
import { mergePrivateSplit } from "@/src/features/splits/cloudMerge";
import { getFirebaseAuth, getFirestoreDb } from "./firebase/config";
import { normalizeError } from "./errors";

const PRIVATE_COLLECTIONS = [
  ["accounts", "accounts"],
  ["categories", "categories"],
  ["budget_categories", "budgetCategories"],
  ["transactions", "transactions"],
  ["budgets", "budgets"],
  ["savings", "savings"],
  ["split_contacts", "splitContacts"],
  ["splits", "splits"],
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
  if (!firestore) return;
  for (const item of await listOutbox(userId)) {
    try {
      const payload = await getCloudPayload(item.entityType, item.entityId);
      if (!payload) {
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
  localName: Exclude<OutboxItem["entityType"], "profiles">,
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
    if (localName === "splits") {
      for (const row of snapshot.docs) await mergePrivateSplit(row.data());
    } else {
      await mergeRemoteRows(localName, rows);
    }
    if (snapshot.size < PULL_PAGE_SIZE) break;
    cursor = snapshot.docs.at(-1) ?? null;
  }
  await setLastPulledAt(userId, localName, pullStartedAt);
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
  // Restore settlements only after their parent splits and private contacts
  // are present locally so SQLite foreign keys remain valid.
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
