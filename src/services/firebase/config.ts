import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  getReactNativePersistence,
  initializeAuth,
  type Auth,
} from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getFunctions, type Functions } from "firebase/functions";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY?.trim(),
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim(),
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID?.trim(),
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim(),
  messagingSenderId:
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim(),
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID?.trim(),
};

export const isFirebaseConfigured =
  Object.values(firebaseConfig).every(Boolean);

export const isFirebaseFunctionsEnabled =
  isFirebaseConfigured &&
  process.env.EXPO_PUBLIC_FIREBASE_FUNCTIONS_ENABLED?.trim().toLowerCase() ===
    "true";

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let firestore: Firestore | null = null;
let functions: Functions | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured) return null;
  app ??= getApps().length ? getApp() : initializeApp(firebaseConfig);
  return app;
}

export function requireFirebaseApp(): FirebaseApp {
  const value = getFirebaseApp();
  if (!value) {
    throw new Error(
      "Firebase is not configured. WalletWise is still fully available in local-only mode.",
    );
  }
  return value;
}

export function getFirebaseAuth(): Auth | null {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;
  if (!auth) {
    try {
      auth = initializeAuth(firebaseApp, {
        persistence: getReactNativePersistence(AsyncStorage),
      });
    } catch {
      auth = getAuth(firebaseApp);
    }
  }
  return auth;
}

export function requireFirebaseAuth(): Auth {
  const value = getFirebaseAuth();
  if (!value)
    throw new Error("Sign-in is unavailable until Firebase is configured.");
  return value;
}

export function getFirestoreDb(): Firestore | null {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;
  firestore ??= getFirestore(firebaseApp);
  return firestore;
}

export function requireFirestoreDb(): Firestore {
  const value = getFirestoreDb();
  if (!value)
    throw new Error(
      "Cloud storage is unavailable until Firebase is configured.",
    );
  return value;
}

export function getFirebaseFunctions(): Functions | null {
  if (!isFirebaseFunctionsEnabled) return null;
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;
  functions ??= getFunctions(
    firebaseApp,
    process.env.EXPO_PUBLIC_FIREBASE_FUNCTIONS_REGION?.trim() || "us-central1",
  );
  return functions;
}

export function requireFirebaseFunctions(): Functions {
  const value = getFirebaseFunctions();
  if (!value)
    throw new Error(
      "This feature needs WalletWise cloud functions, which are disabled on the current free Firebase plan.",
    );
  return value;
}
