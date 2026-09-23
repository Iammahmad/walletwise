import * as Network from "expo-network";
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { type PropsWithChildren, useEffect, useRef } from "react";

import { getDatabase } from "@/src/db/database";
import { getProfile } from "@/src/db/repository";
import { logSafeError } from "@/src/services/errors";
import {
  getFirebaseAuth,
  isFirebaseConfigured,
} from "@/src/services/firebase/config";
import {
  isConnectivityTransition,
  isNetworkOnline,
} from "@/src/services/networkState";
import {
  registerPushNotifications,
  subscribeToNotificationResponses,
} from "@/src/services/notifications";
import { syncNow } from "@/src/services/sync";
import { useAppStore } from "@/src/state/appStore";

export function AppProvider({ children }: PropsWithChildren) {
  const router = useRouter();
  const setProfile = useAppStore((state) => state.setProfile);
  const setInitialized = useAppStore((state) => state.setInitialized);
  const setOnline = useAppStore((state) => state.setOnline);
  const setSyncState = useAppStore((state) => state.setSyncState);
  const bump = useAppStore((state) => state.bumpDbRevision);
  const lastOnline = useRef<boolean | null>(null);

  useEffect(
    () =>
      subscribeToNotificationResponses((data) => {
        void syncNow()
          .catch((error) => logSafeError("notification-sync", error))
          .finally(() => {
            bump();
            if (typeof data.splitId === "string") {
              router.push({
                pathname: "/split/[id]",
                params: { id: data.splitId },
              });
            } else {
              router.push("/(tabs)/splits");
            }
          });
      }),
    [bump, router],
  );

  useEffect(() => {
    let mounted = true;
    const initialize = async () => {
      try {
        await getDatabase();
        const profile = await getProfile();
        if (!mounted) return;
        setProfile(profile);
        setSyncState(
          isFirebaseConfigured ? "idle" : "disabled",
          isFirebaseConfigured ? null : "Firebase backup is not configured.",
        );
        setInitialized(true);
      } catch (error) {
        logSafeError("initialize", error);
        if (mounted)
          setInitialized(
            false,
            "WalletWise could not open its local database. Restart the app and try again.",
          );
      }
    };
    void initialize();

    const subscription = Network.addNetworkStateListener((state) => {
      const online = isNetworkOnline(state);
      if (!isConnectivityTransition(lastOnline.current, online)) return;
      lastOnline.current = online;
      setOnline(online);
      if (!online) {
        if (isFirebaseConfigured) setSyncState("offline");
        return;
      }
      if (isFirebaseConfigured && getFirebaseAuth()?.currentUser) {
        setSyncState("syncing");
        void syncNow()
          .then(async () => {
            const refreshedProfile = await getProfile();
            if (mounted) {
              setProfile(refreshedProfile);
              setSyncState("idle");
              bump();
            }
          })
          .catch((error) => {
            logSafeError("background-sync", error);
            if (mounted)
              setSyncState("error", "Cloud sync will retry automatically.");
          });
      }
    });
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [bump, setInitialized, setOnline, setProfile, setSyncState]);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) return;
    return onAuthStateChanged(auth, (user) => {
      if (!user) return;
      void registerPushNotifications().catch((error) =>
        logSafeError("push-registration", error),
      );
      void syncNow()
        .then(async () => {
          setProfile(await getProfile());
          setSyncState("idle");
          bump();
        })
        .catch((error) => {
          logSafeError("auth-sync", error);
          setSyncState("error", "Firebase sync will retry automatically.");
        });
    });
  }, [bump, setProfile, setSyncState]);

  return children;
}
