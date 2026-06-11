module.exports = {
  expo: {
    name: process.env.EXPO_PUBLIC_APP_NAME || "Notes Express",
    slug: process.env.EXPO_PUBLIC_APP_SLUG || "notes-express",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/blank-splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: process.env.EXPO_PUBLIC_BUNDLE_ID || "com.notesexpress.app",
      // ── Permissions ────────────────────────────────────────────────────────
      infoPlist: {
        NSCameraUsageDescription:
          "Notes Express uses the camera to scan QR codes for joining classes.",
        NSPhotoLibraryUsageDescription:
          "Notes Express needs access to your photo library to upload profile pictures and share images in chats.",
        NSMicrophoneUsageDescription:
          "Notes Express uses the microphone to record voice messages in chats.",
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      edgeToEdgeEnabled: true,
      package: process.env.EXPO_PUBLIC_BUNDLE_ID || "com.notesexpress.app",
      // ── Permissions ────────────────────────────────────────────────────────
      permissions: [
        "android.permission.CAMERA",
        "android.permission.READ_MEDIA_IMAGES",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.RECORD_AUDIO",
        "android.permission.VIBRATE",
        "android.permission.RECEIVE_BOOT_COMPLETED",
      ],
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    plugins: [
      "expo-asset",
      "expo-font",
      // ── Push Notifications ────────────────────────────────────────────────
      [
        "expo-notifications",
        {
          icon: "./assets/icon.png",
          color: "#4F46E5",
          defaultChannel: "default",
          sounds: []
        }
      ],
      // ── Camera (QR scanner) ───────────────────────────────────────────────
      [
        "expo-camera",
        {
          cameraPermission: "Notes Express uses the camera to scan QR codes for joining classes."
        }
      ],
      "expo-web-browser"
    ],
    extra: {
      eas: {
        projectId: "396c16e3-6904-41f7-b4ad-7df0570474b9"
      }
    }
  }
};
