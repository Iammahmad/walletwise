import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { httpsCallable } from "firebase/functions";
import { Platform } from "react-native";

import { getFirebaseAuth, getFirebaseFunctions } from "./firebase/config";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function registerPushNotifications(): Promise<boolean> {
  const user = getFirebaseAuth()?.currentUser;
  const functions = getFirebaseFunctions();
  if (
    !user ||
    !functions ||
    !Device.isDevice ||
    (Platform.OS !== "android" && Platform.OS !== "ios")
  )
    return false;
  const current = await Notifications.getPermissionsAsync();
  const permission = current.granted
    ? current
    : await Notifications.requestPermissionsAsync();
  if (!permission.granted) return false;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("splits", {
      name: "Split invitations and updates",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 180, 120, 180],
      lightColor: "#9A6BFF",
    });
  }
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
  if (!projectId)
    throw new Error("The EAS project ID is required for push notifications.");
  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  const register = httpsCallable<
    { token: string; platform: string },
    { registered: boolean }
  >(functions, "registerPushToken");
  await register({ token: token.data, platform: Platform.OS });
  return true;
}

export function subscribeToNotificationResponses(
  listener: (data: Record<string, unknown>) => void,
): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      listener(
        response.notification.request.content.data as Record<string, unknown>,
      );
    },
  );
  return () => subscription.remove();
}
