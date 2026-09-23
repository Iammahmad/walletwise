import { Platform } from "react-native";

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();

export const isGoogleSignInConfigured = Boolean(
  webClientId && (Platform.OS !== "ios" || iosClientId),
);

export async function requestGoogleIdToken(): Promise<string | null> {
  if (!isGoogleSignInConfigured) {
    throw new Error("Google Sign-In is not configured for this build.");
  }
  if (Platform.OS === "web") {
    throw new Error(
      "Google Sign-In is currently available in the Android and iOS apps.",
    );
  }
  try {
    const { GoogleSignin, isSuccessResponse } =
      await import("@react-native-google-signin/google-signin");
    GoogleSignin.configure({
      webClientId,
      iosClientId,
      offlineAccess: false,
      scopes: ["email", "profile"],
    });
    if (Platform.OS === "android") {
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });
    }
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return null;
    if (!response.data.idToken) {
      throw new Error("Google did not return an identity token.");
    }
    return response.data.idToken;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Google Sign-In failed.";
    if (/native module|RNGoogleSignin|TurboModule/i.test(message)) {
      throw new Error(
        "Google Sign-In requires a new WalletWise development build. Rebuild the app after installing native dependencies.",
      );
    }
    throw error;
  }
}
