import type { ConfigContext, ExpoConfig } from 'expo/config';
import { withEntitlementsPlist, type ConfigPlugin } from 'expo/config-plugins';

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

// Local device builds on a free Apple ID ("personal team") can't sign Sign in with Apple or
// Push Notifications. IOS_PERSONAL_TEAM=1 drops both entitlements so `expo run:ios --device`
// works; Apple sign-in and push won't work in that build. Never set it for EAS builds.
const PERSONAL_TEAM = process.env.IOS_PERSONAL_TEAM === '1';

const withoutPaidEntitlements: ConfigPlugin = (config) =>
  withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults['aps-environment'];
    delete cfg.modResults['com.apple.developer.applesignin'];
    return cfg;
  });

// Universal Links / App Links: https://<site>/invite/<code> opens the app when installed.
// Only production claims the real domain; set EXPO_PUBLIC_SITE_URL for each EAS environment.
const SITE_HOST = (() => {
  try {
    return new URL(process.env.EXPO_PUBLIC_SITE_URL ?? '').host || null;
  } catch {
    return null;
  }
})();

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
          "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeProductInteraction",
          "NSPrivacyCollectedDataTypeLinked": true,
          "NSPrivacyCollectedDataTypeTracking": false,
          "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAnalytics"]
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

const withVariant = ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  ...base,
  name: variant.name,
  scheme: variant.scheme,
  ios: {
    ...base.ios,
    bundleIdentifier: variant.id,
    ...(PERSONAL_TEAM ? { usesAppleSignIn: false } : null),
    ...(SITE_HOST ? { associatedDomains: [`applinks:${SITE_HOST}`] } : null),
  },
  android: {
    ...base.android,
    package: variant.id,
    ...(SITE_HOST
      ? {
          intentFilters: [
            {
              action: 'VIEW',
              autoVerify: true,
              data: [{ scheme: 'https', host: SITE_HOST, pathPrefix: '/invite' }],
              category: ['BROWSABLE', 'DEFAULT'],
            },
          ],
        }
      : null),
  },
  plugins: [
    ...(base.plugins ?? []),
    [
      '@sentry/react-native',
      { organization: process.env.SENTRY_ORG, project: process.env.SENTRY_PROJECT, url: 'https://sentry.io/' },
    ],
  ],
  extra: { ...base.extra, appVariant: VARIANT },
});

// Applied before the `plugins` list, so its entitlements mod runs after theirs and has the last word.
export default (ctx: ConfigContext): ExpoConfig =>
  PERSONAL_TEAM ? withoutPaidEntitlements(withVariant(ctx)) : withVariant(ctx);
