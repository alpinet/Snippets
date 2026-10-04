import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Three app variants so dev, staging and production can live side by side on one phone,
 * each pointed at its own Supabase project via EAS environment variables.
 * APP_VARIANT is set per build profile in eas.json.
 */
const VARIANT = (process.env.APP_VARIANT ?? 'development') as 'development' | 'preview' | 'production';
const BUNDLE_ID = 'com.snippets.app'; // TODO(before release): replace with an identifier you own

const variant = {
  development: { name: 'Snippets Dev', id: `${BUNDLE_ID}.dev`, scheme: 'snippets-dev' },
  preview: { name: 'Snippets Beta', id: `${BUNDLE_ID}.beta`, scheme: 'snippets-beta' },
  production: { name: 'Snippets', id: BUNDLE_ID, scheme: 'snippets' },
}[VARIANT];

const base: ExpoConfig = {
  "name": "Snippets",
  "slug": "snippets",
  "scheme": "snippets",
  "version": "1.0.0",
  "orientation": "portrait",
  "icon": "./assets/icon.png",
  "userInterfaceStyle": "light",
  "backgroundColor": "#FAF8F5",
  "primaryColor": "#BF6547",
  "ios": {
    "bundleIdentifier": "com.snippets.app",
    "buildNumber": "1",
    "supportsTablet": false,
    "usesAppleSignIn": true,
    "config": {
      "usesNonExemptEncryption": false
    },
    "infoPlist": {
      "CFBundleDisplayName": "Snippets"
    },
    "privacyManifests": {
      "NSPrivacyAccessedAPITypes": [
        {
          "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryUserDefaults",
          "NSPrivacyAccessedAPITypeReasons": [
            "CA92.1"
          ]
        },
        {
          "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryFileTimestamp",
          "NSPrivacyAccessedAPITypeReasons": [
            "C617.1"
          ]
        },
        {
          "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategorySystemBootTime",
          "NSPrivacyAccessedAPITypeReasons": [
            "35F9.1"
          ]
        },
        {
          "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryDiskSpace",
          "NSPrivacyAccessedAPITypeReasons": [
            "E174.1"
          ]
        }
      ],
      "NSPrivacyCollectedDataTypes": [
        {
          "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypePhotosorVideos",
          "NSPrivacyCollectedDataTypeLinked": true,
          "NSPrivacyCollectedDataTypeTracking": false,
          "NSPrivacyCollectedDataTypePurposes": [
            "NSPrivacyCollectedDataTypePurposeAppFunctionality"
          ]
        },
        {
          "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeEmailAddress",
          "NSPrivacyCollectedDataTypeLinked": true,
          "NSPrivacyCollectedDataTypeTracking": false,
          "NSPrivacyCollectedDataTypePurposes": [
            "NSPrivacyCollectedDataTypePurposeAppFunctionality"
          ]
        },
        {
          "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeName",
          "NSPrivacyCollectedDataTypeLinked": true,
          "NSPrivacyCollectedDataTypeTracking": false,
          "NSPrivacyCollectedDataTypePurposes": [
            "NSPrivacyCollectedDataTypePurposeAppFunctionality"
          ]
        },
        {
          "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeOtherUserContent",
          "NSPrivacyCollectedDataTypeLinked": true,
          "NSPrivacyCollectedDataTypeTracking": false,
          "NSPrivacyCollectedDataTypePurposes": [
            "NSPrivacyCollectedDataTypePurposeAppFunctionality"
          ]
        }
      ],
      "NSPrivacyTracking": false
    }
  },
  "android": {
    "package": "com.snippets.app",
    "versionCode": 1,
    "adaptiveIcon": {
      "backgroundColor": "#BF6547",
      "foregroundImage": "./assets/android-icon-foreground.png",
      "backgroundImage": "./assets/android-icon-background.png",
      "monochromeImage": "./assets/android-icon-monochrome.png"
    },
    "blockedPermissions": [
      "android.permission.RECORD_AUDIO",
      "android.permission.CAMERA"
    ],
    "predictiveBackGestureEnabled": false
  },
  "plugins": [
    "expo-router",
    [
      "expo-splash-screen",
      {
        "image": "./assets/splash-icon.png",
        "imageWidth": 120,
        "resizeMode": "contain",
        "backgroundColor": "#FAF8F5"
      }
    ],
    [
      "expo-image-picker",
      {
        "photosPermission": "Snippets uses photos and videos you choose from your library to create moments you share with friends.",
        "cameraPermission": false,
        "microphonePermission": false
      }
    ],
    "expo-apple-authentication",
    [
      "expo-notifications",
      {
        "icon": "./assets/notification-icon.png",
        "color": "#BF6547"
      }
    ],
    "expo-video",
    "expo-web-browser",
    "expo-secure-store",
    "expo-image",
    "expo-status-bar"
  ],
  "experiments": {
    "typedRoutes": true
  },
  "extra": {
    "eas": {}
  }
};

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  ...base,
  name: variant.name,
  scheme: variant.scheme,
  ios: { ...base.ios, bundleIdentifier: variant.id },
  android: { ...base.android, package: variant.id },
  plugins: [
    ...(base.plugins ?? []),
    [
      '@sentry/react-native',
      { organization: process.env.SENTRY_ORG, project: process.env.SENTRY_PROJECT, url: 'https://sentry.io/' },
    ],
  ],
  extra: { ...base.extra, appVariant: VARIANT },
});
