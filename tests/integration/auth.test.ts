import * as repository from "@/src/db/repository";
import {
  deleteCloudAccount,
  signIn,
  signInWithGoogleIdToken,
} from "@/src/services/auth";
import {
  requireFirebaseAuth,
  requireFirestoreDb,
} from "@/src/services/firebase/config";
import {
  GoogleAuthProvider,
  deleteUser,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { deleteDoc, getDoc, getDocs } from "firebase/firestore";

jest.mock("@/src/db/repository", () => ({
  getProfile: jest.fn(),
  linkLocalDataToUser: jest.fn(),
  preparePristineLocalDataForCloudRestore: jest.fn(),
  unlinkCloudUser: jest.fn(),
}));
jest.mock("@/src/services/firebase/config", () => ({
  requireFirebaseAuth: jest.fn(),
  requireFirestoreDb: jest.fn(),
  requireFirebaseFunctions: jest.fn(),
  isFirebaseFunctionsEnabled: false,
}));
jest.mock("firebase/auth", () => ({
  createUserWithEmailAndPassword: jest.fn(),
  deleteUser: jest.fn(),
  GoogleAuthProvider: { credential: jest.fn() },
  sendEmailVerification: jest.fn(),
  signInWithCredential: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
}));
jest.mock("firebase/firestore", () => ({
  collection: jest.fn(() => ({ path: "users/user-1/collection" })),
  deleteDoc: jest.fn(),
  doc: jest.fn(() => ({ path: "users/user-1" })),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  limit: jest.fn((value: number) => ({ limit: value })),
  query: jest.fn((reference: unknown) => reference),
  writeBatch: jest.fn(() => ({
    delete: jest.fn(),
    commit: jest.fn(),
  })),
}));
jest.mock("firebase/functions", () => ({ httpsCallable: jest.fn() }));

const profile = {
  id: "local-owner-1",
  userId: null,
  defaultCurrency: "PKR",
  locale: "en-PK",
  timezone: "Asia/Karachi",
  onboardingCompleted: true,
  cloudAiEnabled: false,
  theme: "system" as const,
  createdAt: "2026-08-30T00:00:00.000Z",
  updatedAt: "2026-08-30T00:00:00.000Z",
};
const user = { uid: "user-1", email: "user@example.com", emailVerified: true };
const auth = { currentUser: user };

describe("Firebase authentication and local-ledger ownership", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(requireFirebaseAuth).mockReturnValue(auth as never);
    jest.mocked(requireFirestoreDb).mockReturnValue({} as never);
    jest
      .mocked(signInWithEmailAndPassword)
      .mockResolvedValue({ user } as never);
    jest.mocked(signInWithCredential).mockResolvedValue({ user } as never);
    jest
      .mocked(GoogleAuthProvider.credential)
      .mockReturnValue({ providerId: "google.com" } as never);
    jest.mocked(getDoc).mockResolvedValue({ exists: () => false } as never);
    jest.mocked(getDocs).mockResolvedValue({ empty: true, docs: [] } as never);
    jest.mocked(deleteDoc).mockResolvedValue(undefined);
    jest.mocked(deleteUser).mockResolvedValue(undefined);
    jest.mocked(repository.getProfile).mockResolvedValue(profile);
    jest
      .mocked(repository.preparePristineLocalDataForCloudRestore)
      .mockResolvedValue(false);
  });

  it("links an unowned local ledger after email sign-in", async () => {
    await signIn(" user@example.com ", "password");
    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
      auth,
      "user@example.com",
      "password",
    );
    expect(repository.linkLocalDataToUser).toHaveBeenCalledWith("user-1");
  });

  it("prepares a pristine device for restore when a cloud profile exists", async () => {
    jest.mocked(getDoc).mockResolvedValueOnce({ exists: () => true } as never);
    jest
      .mocked(repository.preparePristineLocalDataForCloudRestore)
      .mockResolvedValueOnce(true);
    await signIn("user@example.com", "password");
    expect(
      repository.preparePristineLocalDataForCloudRestore,
    ).toHaveBeenCalledWith("user-1");
    expect(repository.linkLocalDataToUser).not.toHaveBeenCalled();
  });

  it("rejects a different account and clears the Firebase session", async () => {
    jest
      .mocked(repository.getProfile)
      .mockResolvedValueOnce({ ...profile, userId: "another-user" });
    await expect(signIn("user@example.com", "password")).rejects.toThrow(
      "linked to a different account",
    );
    expect(firebaseSignOut).toHaveBeenCalledWith(auth);
    expect(repository.linkLocalDataToUser).not.toHaveBeenCalled();
  });

  it("exchanges a Google ID token for Firebase credentials", async () => {
    await signInWithGoogleIdToken("google-id-token");
    expect(GoogleAuthProvider.credential).toHaveBeenCalledWith(
      "google-id-token",
    );
    expect(signInWithCredential).toHaveBeenCalled();
    expect(repository.linkLocalDataToUser).toHaveBeenCalledWith("user-1");
  });

  it("rejects an empty Google identity token", async () => {
    await expect(signInWithGoogleIdToken(" ")).rejects.toThrow(
      "valid identity token",
    );
    expect(signInWithCredential).not.toHaveBeenCalled();
  });

  it("deletes private cloud data and auth identity in free mode", async () => {
    await deleteCloudAccount();
    expect(getDocs).toHaveBeenCalledTimes(9);
    expect(deleteDoc).toHaveBeenCalledWith({ path: "users/user-1" });
    expect(deleteUser).toHaveBeenCalledWith(user);
    expect(repository.unlinkCloudUser).toHaveBeenCalled();
  });
});
