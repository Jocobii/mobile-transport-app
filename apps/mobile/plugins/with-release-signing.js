const { withAppBuildGradle } = require("@expo/config-plugins");

/**
 * EPIC-010 T06: adds a `release` signing config to `android/app/build.gradle` that reads a
 * personal upload keystore from Gradle properties (`~/.gradle/gradle.properties`, never
 * committed) — `TRANSIT_UPLOAD_STORE_FILE`, `TRANSIT_UPLOAD_STORE_PASSWORD`,
 * `TRANSIT_UPLOAD_KEY_ALIAS`, `TRANSIT_UPLOAD_KEY_PASSWORD` — and uses it for release builds
 * only when all four are present. Falls back to the debug keystore otherwise (CI and everyday
 * `expo run:android` keep working with no properties set).
 *
 * `android/` is generated (CNG) and git-ignored, so this runs on every prebuild instead of a
 * hand-edited file. See `apps/mobile/README.md` for how to create the keystore.
 */
const withReleaseSigning = (config) =>
  withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== "groovy") {
      throw new Error("withReleaseSigning only supports Groovy app/build.gradle files");
    }
    config.modResults.contents = addReleaseSigningConfig(config.modResults.contents);
    return config;
  });

const MARKER = "// EPIC-010 release signing (with-release-signing.js)";

function addReleaseSigningConfig(contents) {
  if (contents.includes(MARKER)) return contents; // already applied

  const debugSigningConfig = `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }`;
  const withReleaseSigningConfig = `    ${MARKER}
    def hasReleaseSigningConfig =
        project.hasProperty('TRANSIT_UPLOAD_STORE_FILE') &&
        project.hasProperty('TRANSIT_UPLOAD_STORE_PASSWORD') &&
        project.hasProperty('TRANSIT_UPLOAD_KEY_ALIAS') &&
        project.hasProperty('TRANSIT_UPLOAD_KEY_PASSWORD')

    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        if (hasReleaseSigningConfig) {
            release {
                storeFile file(TRANSIT_UPLOAD_STORE_FILE)
                storePassword TRANSIT_UPLOAD_STORE_PASSWORD
                keyAlias TRANSIT_UPLOAD_KEY_ALIAS
                keyPassword TRANSIT_UPLOAD_KEY_PASSWORD
            }
        }
    }`;

  if (!contents.includes(debugSigningConfig)) {
    throw new Error(
      "withReleaseSigning: could not find the expected default signingConfigs block in app/build.gradle. " +
        "The Expo/React Native template may have changed; update apps/mobile/plugins/with-release-signing.js.",
    );
  }
  contents = contents.replace(debugSigningConfig, withReleaseSigningConfig);

  const debugSigningConfigUsage = `        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug`;
  const conditionalSigningConfigUsage = `        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig hasReleaseSigningConfig ? signingConfigs.release : signingConfigs.debug`;

  if (!contents.includes(debugSigningConfigUsage)) {
    throw new Error(
      "withReleaseSigning: could not find the expected release buildType in app/build.gradle. " +
        "The Expo/React Native template may have changed; update apps/mobile/plugins/with-release-signing.js.",
    );
  }
  contents = contents.replace(debugSigningConfigUsage, conditionalSigningConfigUsage);

  return contents;
}

module.exports = withReleaseSigning;
