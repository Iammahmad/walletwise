import * as repository from "@/src/db/repository";
import * as firebaseConfig from "@/src/services/firebase/config";
import { syncNow } from "@/src/services/sync";
import { getDoc, getDocs, setDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

jest.mock("@/src/db/repository", () => ({
  listOutbox: jest.fn(),
  getCloudPayload: jest.fn(),
  markOutboxSuccess: jest.fn(),
  markOutboxFailure: jest.fn(),
  mergeRemoteProfile: jest.fn(),
  mergeRemoteRows: jest.fn(),
  getLastPulledAt: jest.fn(),
  setLastPulledAt: jest.fn(),
}));
jest.mock("@/src/features/splits/cloudMerge", () => ({
  mergeRemoteSplit: jest.fn(),
}));
jest.mock("@/src/services/firebase/config", () => ({
  getFirebaseAuth: jest.fn(),
  getFirebaseFunctions: jest.fn(),
  getFirestoreDb: jest.fn(),
}));
jest.mock("firebase/firestore", () => ({
  collection: jest.fn((...parts: string[]) => parts.join("/")),
  doc: jest.fn((...parts: unknown[]) => parts.slice(1).join("/")),
  documentId: jest.fn(() => "__name__"),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  limit: jest.fn((value: number) => ({ limit: value })),
  orderBy: jest.fn((field: string, direction?: string) => ({
    orderBy: field,
    direction,
  })),
  query: jest.fn((reference: unknown, ...constraints: unknown[]) => ({
    reference,
    constraints,
  })),
  setDoc: jest.fn(),
  startAfter: jest.fn((cursor: unknown) => ({ cursor })),
  where: jest.fn((field: string, operation: string, value: unknown) => ({
    field,
    operation,
    value,
  })),
}));
jest.mock("firebase/functions", () => ({ httpsCallable: jest.fn() }));

const outboxItem = {
  id: "outbox-1",
  userId: "user-1",
  entityType: "transactions" as const,
  entityId: "tx-1",
  attemptCount: 0,
};
const emptySnapshot = { docs: [], size: 0 };
const splitCallable = jest.fn();

describe("Firebase offline outbox and sync", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .mocked(firebaseConfig.getFirebaseAuth)
      .mockReturnValue({ currentUser: { uid: "user-1" } } as never);
    jest.mocked(firebaseConfig.getFirestoreDb).mockReturnValue({} as never);
    jest
      .mocked(firebaseConfig.getFirebaseFunctions)
      .mockReturnValue({} as never);
    jest.mocked(repository.listOutbox).mockResolvedValue([outboxItem]);
    jest.mocked(repository.getCloudPayload).mockResolvedValue({
      id: "tx-1",
      user_id: "user-1",
      amount_minor: 600,
      updated_at: "2026-08-30T10:00:00.000Z",
    });
    jest
      .mocked(repository.getLastPulledAt)
      .mockResolvedValue("1970-01-01T00:00:00.000Z");
    jest
      .mocked(getDoc)
      .mockResolvedValueOnce({ data: () => undefined } as never)
      .mockResolvedValue({ exists: () => false } as never);
    jest.mocked(getDocs).mockResolvedValue(emptySnapshot as never);
    jest.mocked(setDoc).mockResolvedValue(undefined);
    splitCallable.mockResolvedValue({ data: { saved: true } });
    jest.mocked(httpsCallable).mockReturnValue(splitCallable as never);
  });

  it("pushes a queued write by UUID and pulls every private collection", async () => {
    await syncNow();
    expect(setDoc).toHaveBeenCalledWith(
      "users/user-1/transactions/tx-1",
      expect.objectContaining({ id: "tx-1" }),
      { merge: true },
    );
    expect(repository.markOutboxSuccess).toHaveBeenCalledWith(outboxItem);
    expect(repository.mergeRemoteRows).toHaveBeenCalledTimes(8);
    expect(
      jest
        .mocked(repository.mergeRemoteRows)
        .mock.calls.map(([table]) => table),
    ).toEqual([
      "accounts",
      "categories",
      "budget_categories",
      "transactions",
      "budgets",
      "savings",
      "split_contacts",
      "split_settlements",
    ]);
    expect(repository.setLastPulledAt).toHaveBeenCalledTimes(9);
  });

  it("keeps a failed write queued for retry", async () => {
    jest.mocked(setDoc).mockRejectedValueOnce(new Error("offline"));
    await syncNow();
    expect(repository.markOutboxFailure).toHaveBeenCalledWith(
      outboxItem,
      expect.any(String),
    );
    expect(repository.markOutboxSuccess).not.toHaveBeenCalled();
  });

  it("does not overwrite a newer cloud row", async () => {
    jest
      .mocked(getDoc)
      .mockReset()
      .mockResolvedValueOnce({
        data: () => ({ updated_at: "2026-08-30T11:00:00.000Z" }),
      } as never)
      .mockResolvedValue({ exists: () => false } as never);
    await syncNow();
    expect(setDoc).not.toHaveBeenCalled();
    expect(repository.markOutboxSuccess).toHaveBeenCalledWith(outboxItem);
  });

  it("uses the protected callable for a shared split", async () => {
    jest
      .mocked(repository.listOutbox)
      .mockResolvedValueOnce([
        { ...outboxItem, entityType: "splits", entityId: "split-1" },
      ]);
    jest.mocked(repository.getCloudPayload).mockResolvedValueOnce({
      id: "split-1",
      participant_uids: ["user-1", "user-2"],
    });
    jest
      .mocked(getDoc)
      .mockReset()
      .mockResolvedValue({ exists: () => false } as never);
    await syncNow();
    expect(splitCallable).toHaveBeenCalledWith(
      expect.objectContaining({ id: "split-1" }),
    );
    expect(setDoc).not.toHaveBeenCalled();
  });

  it("keeps private backup working when cloud functions are disabled", async () => {
    jest.mocked(firebaseConfig.getFirebaseFunctions).mockReturnValue(null);
    const splitItem = {
      ...outboxItem,
      id: "outbox-2",
      entityType: "splits" as const,
      entityId: "split-1",
    };
    jest
      .mocked(repository.listOutbox)
      .mockResolvedValueOnce([outboxItem, splitItem]);
    jest
      .mocked(repository.getCloudPayload)
      .mockResolvedValueOnce({
        id: "tx-1",
        user_id: "user-1",
        amount_minor: 600,
        updated_at: "2026-08-30T10:00:00.000Z",
      })
      .mockResolvedValueOnce({
        id: "split-1",
        participant_uids: ["user-1", "user-2"],
      });

    await syncNow();

    expect(setDoc).toHaveBeenCalledWith(
      "users/user-1/transactions/tx-1",
      expect.objectContaining({ id: "tx-1" }),
      { merge: true },
    );
    expect(repository.markOutboxSuccess).toHaveBeenCalledWith(outboxItem);
    expect(repository.markOutboxSuccess).not.toHaveBeenCalledWith(splitItem);
    expect(splitCallable).not.toHaveBeenCalled();
  });
});
