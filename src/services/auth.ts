import {
  createUserWithEmailAndPassword,
  deleteUser as deleteFirebaseUser,
  GoogleAuthProvider,
  sendEmailVerification,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

import {
  getProfile,
  linkLocalDataToUser,
  preparePristineLocalDataForCloudRestore,
  unlinkCloudUser,
} from "@/src/db/repository";
import {
  requireFirebaseAuth,
  requireFirebaseFunctions,
  requireFirestoreDb,
  isFirebaseFunctionsEnabled,
} from "./firebase/config";

const PRIVATE_CLOUD_COLLECTIONS = [
  "accounts",
  "categories",
  "budgetCategories",
  "transactions",
  "budgets",
  "savings",
  "splitContacts",
  "splitSettlements",
  "pushTokens",
] as const;

async function deletePrivateCollection(
  firestore: Firestore,
  userId: string,
  collectionName: string,
): Promise<void> {
  while (true) {
    const snapshot = await getDocs(
      query(collection(firestore, "users", userId, collectionName), limit(400)),
    );
    if (snapshot.empty) return;
    const batch = writeBatch(firestore);
    snapshot.docs.forEach((item) => batch.delete(item.ref));
    await batch.commit();
  }
}

async function deleteFreePlanAccount(user: User): Promise<void> {
  const firestore = requireFirestoreDb();
  for (const collectionName of PRIVATE_CLOUD_COLLECTIONS) {
    await deletePrivateCollection(firestore, user.uid, collectionName);
  }
  await deleteDoc(doc(firestore, "users", user.uid));
  await deleteFirebaseUser(user);
}

async function connectLocalData(user: User): Promise<User> {
  const localProfile = await getProfile();
  if (localProfile.userId && localProfile.userId !== user.uid) {
    await firebaseSignOut(requireFirebaseAuth());
    throw new Error(
      "This device ledger is linked to a different account. Sign in with that account, or reset local data before switching accounts.",
    );
  }
  if (localProfile.userId === user.uid) return user;
  const remoteProfile = await getDoc(
    doc(requireFirestoreDb(), "users", user.uid),
  );
  if (
    remoteProfile.exists() &&
    (await preparePristineLocalDataForCloudRestore(user.uid))
  ) {
    return user;
  }
  await linkLocalDataToUser(user.uid);
  return user;
}

export function getCurrentUser(): User | null {
  return requireFirebaseAuth().currentUser;
}

export async function signIn(email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(
    requireFirebaseAuth(),
    email.trim(),
    password,
  );
  if (!credential.user.emailVerified) {
    await sendEmailVerification(credential.user).catch(() => undefined);
    await firebaseSignOut(requireFirebaseAuth());
    throw new Error(
      "Verify your email before signing in. We sent a new verification link.",
    );
  }
  return connectLocalData(credential.user);
}

export async function signUp(
  email: string,
  password: string,
): Promise<{ user: User; confirmationRequired: boolean }> {
  const credential = await createUserWithEmailAndPassword(
    requireFirebaseAuth(),
    email.trim(),
    password,
  );
  await sendEmailVerification(credential.user);
  await firebaseSignOut(requireFirebaseAuth());
  return { user: credential.user, confirmationRequired: true };
}

export async function signInWithGoogleIdToken(idToken: string): Promise<User> {
  if (!idToken.trim())
    throw new Error("Google did not return a valid identity token.");
  const credential = GoogleAuthProvider.credential(idToken);
  const result = await signInWithCredential(requireFirebaseAuth(), credential);
  return connectLocalData(result.user);
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(requireFirebaseAuth());
  await unlinkCloudUser();
}

export async function deleteCloudAccount(): Promise<void> {
  const auth = requireFirebaseAuth();
  const user = auth.currentUser;
  if (!user)
    throw new Error("Sign in again before deleting your cloud account.");
  if (isFirebaseFunctionsEnabled) {
    const removeData = httpsCallable<
      { confirmation: "DELETE" },
      { deleted: boolean }
    >(requireFirebaseFunctions(), "deleteAccount");
    await removeData({ confirmation: "DELETE" });
    // The callable deletes the Firebase Auth user on the trusted server.
    await firebaseSignOut(auth).catch(() => undefined);
  } else {
    // Spark/free mode has no shared server records because invitations and
    // shared writes are disabled. The signed-in owner can delete their private
    // tree through Security Rules, then remove their own Auth identity.
    await deleteFreePlanAccount(user);
  }
  await unlinkCloudUser();
}
