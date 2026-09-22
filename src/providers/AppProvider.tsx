import * as Network from "expo-network";
import { type PropsWithChildren, useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { getDatabase } from "@/src/db/database";
import { getProfile } from "@/src/db/repository";
import { getSupabase, isCloudConfigured } from "@/src/services/supabase";
import { logSafeError } from "@/src/services/errors";
import {
  isConnectivityTransition,
  isNetworkOnline,
} from "@/src/services/networkState";
import { syncNow } from "@/src/services/sync";
import { useAppStore } from "@/src/state/appStore";

export function AppProvider({ children }: PropsWithChildren) {
  const setProfile = useAppStore((state) => state.setProfile);
  const setInitialized = useAppStore((state) => state.setInitialized);
  const setOnline = useAppStore((state) => state.setOnline);
  const setSyncState = useAppStore((state) => state.setSyncState);
  const bump = useAppStore((state) => state.bumpDbRevision);
  const lastOnline = useRef<boolean | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    const updateAutoRefresh = (state: AppStateStatus) => {
      if (state === "active") supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    };
    updateAutoRefresh(AppState.currentState);
    const subscription = AppState.addEventListener("change", updateAutoRefresh);
    return () => {
      subscription.remove();
      supabase.auth.stopAutoRefresh();
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const initialize = async () => {
      try {
        await getDatabase();
        const profile = await getProfile();
        if (!mounted) return;
        setProfile(profile);
        setSyncState(
          isCloudConfigured ? "idle" : "disabled",
          isCloudConfigured ? null : "Cloud backup is not configured.",
        );
        setInitialized(true);
      } catch (error) {
        logSafeError("initialize", error);
        if (mounted)
          setInitialized(
            false,
            "SpendSpeak could not open its local database. Restart the app and try again.",
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
        if (isCloudConfigured) setSyncState("offline");
        return;
      }
      if (isCloudConfigured) {
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

  return children;
}
