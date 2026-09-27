import type { ConfigContext, ExpoConfig } from "expo/config";
import withReleaseSigning from "./plugins/with-release-signing.js";

const APP_ID = "dev.gamoro.transit";

/** Native permission prompt shown by the OS; it is not part of the in-app i18n files. */
const LOCATION_PERMISSION_TEXT =
  "Necesitamos tu ubicación para mostrarte las paradas y los camiones cerca de ti.";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "mobile",
  slug: "mobile",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "mobile",
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: APP_ID,
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#0F2B52",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: true,
    package: APP_ID,
  },
  web: {
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#0F2B52",
        image: "./assets/images/splash-icon.png",
        // Pin height = 260 × 616/1024 ≈ 156 dp; keep in sync with NATIVE_SPLASH_PIN_HEIGHT
        // (src/shared/splash-scene.ts) so the hand-off to BrandSplash is seamless.
        imageWidth: 260,
      },
    ],
    [
      // Kept here (not in the generated `android/`) so `prebuild` does not lose it. Release builds
      // shrink the code and resources; only the phone's ABI is compiled (faster build, smaller APK).
      "expo-build-properties",
      {
        android: {
          buildArchs: ["arm64-v8a"],
          enableMinifyInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
        },
      },
    ],
    [
      "expo-location",
      {
        locationWhenInUsePermission: LOCATION_PERMISSION_TEXT,
      },
    ],
    [
      "react-native-maps",
      {
        androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY ?? "",
      },
    ],
    // @ts-expect-error `ExpoConfig["plugins"]` in @expo/config-types does not include function
    // config plugins in its type, even though the config loader accepts them at runtime.
    withReleaseSigning,
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
});
