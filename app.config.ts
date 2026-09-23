import type { ConfigContext, ExpoConfig } from "expo/config";

function googleIosUrlScheme(): string | null {
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
  const suffix = ".apps.googleusercontent.com";
  if (!clientId?.endsWith(suffix)) return null;
  return `com.googleusercontent.apps.${clientId.slice(0, -suffix.length)}`;
}

export default function configureExpo(_context: ConfigContext): ExpoConfig {
  const iosUrlScheme = googleIosUrlScheme();
  const plugins: NonNullable<ExpoConfig["plugins"]> = [
    "expo-router",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#170B2B",
        image: "./assets/walletwise-icon-purple-v1.png",
        imageWidth: 180,
        resizeMode: "contain",
        dark: {
          backgroundColor: "#170B2B",
          image: "./assets/walletwise-icon-purple-v1.png",
        },
      },
    ],
    ["expo-sqlite", { enableFTS: true }],
    "expo-localization",
    "expo-secure-store",
    "expo-sharing",
    "expo-status-bar",
    "@react-native-community/datetimepicker",
    [
      "expo-speech-recognition",
      {
        microphonePermission:
          "Allow WalletWise to use the microphone only while you record a money entry.",
        speechRecognitionPermission:
          "Allow WalletWise to transcribe spoken money entries into editable drafts.",
        androidSpeechServicePackages: [
          "com.google.android.googlequicksearchbox",
          "com.google.android.tts",
          "com.google.android.as",
        ],
      },
    ],
    "expo-font",
    [
      "expo-notifications",
      {
        icon: "./assets/walletwise-icon-purple-v1.png",
        color: "#9A6BFF",
        defaultChannel: "splits",
      },
    ],
  ];
  if (iosUrlScheme) {
    plugins.push([
      "@react-native-google-signin/google-signin",
      { iosUrlScheme },
    ]);
  }

  return {
    name: "WalletWise",
    slug: "spendspeak",
    version: "2.0.0",
    orientation: "portrait",
    icon: "./assets/walletwise-icon-purple-v1.png",
    scheme: "walletwise",
    userInterfaceStyle: "automatic",
    ios: {
      supportsTablet: false,
      bundleIdentifier: "com.spendspeak.app",
      infoPlist: {
        NSMicrophoneUsageDescription:
          "Allow WalletWise to use the microphone only while you record a money entry.",
        NSSpeechRecognitionUsageDescription:
          "Allow WalletWise to transcribe spoken money entries into editable drafts.",
      },
    },
    android: {
      googleServicesFile: "./google-services.json",
      adaptiveIcon: {
        backgroundColor: "#170B2B",
        foregroundImage: "./assets/walletwise-icon-purple-v1.png",
        monochromeImage: "./assets/walletwise-icon-purple-v1.png",
      },
      predictiveBackGestureEnabled: false,
      package: "com.spendspeak.app",
      versionCode: 5,
      permissions: ["android.permission.RECORD_AUDIO"],
    },
    web: { favicon: "./assets/walletwise-icon-purple-v1.png" },
    plugins,
    experiments: { typedRoutes: true },
    extra: {
      router: {},
      eas: { projectId: "f8f1791d-0f9a-4d04-b824-cf4cb14dcd67" },
    },
  };
}
