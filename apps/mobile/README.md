# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

## Appendix: release signing (EPIC-010)

The release build is signed with a personal upload keystore instead of the public
`debug.keystore`, so restricting the Google Maps API key to it (see the epic's owner checklist)
actually protects something. `android/` is generated (CNG, git-ignored); the signing config is
added by `apps/mobile/plugins/with-release-signing.js`, registered in `app.config.ts`, on every
prebuild.

### One-time setup

1. Create the keystore (outside the repo; keep it and its passwords somewhere safe — losing it
   means you can never update the app under the same signature again):

   ```bash
   keytool -genkeypair -v -keystore ~/keys/transit-release.keystore -alias transit \
     -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Add the four properties to `~/.gradle/gradle.properties` (never committed; create the file if
   it does not exist yet):

   ```properties
   TRANSIT_UPLOAD_STORE_FILE=/Users/you/keys/transit-release.keystore
   TRANSIT_UPLOAD_STORE_PASSWORD=<the keystore password>
   TRANSIT_UPLOAD_KEY_ALIAS=transit
   TRANSIT_UPLOAD_KEY_PASSWORD=<the key password>
   ```

   `TRANSIT_UPLOAD_STORE_FILE` must be an absolute path (Gradle resolves a relative one against
   the Android project directory, not your home directory).

### Building and verifying

```bash
pnpm --filter @transit/mobile release:android
```

With all four properties present, this signs the release build with the personal keystore
instead of falling back to `debug.keystore`. Confirm the signature:

```bash
keytool -printcert -jarfile <path-to-the-built-apk>
```

The reported SHA-1 should match `keytool -list -v -keystore ~/keys/transit-release.keystore
-alias transit`, and must not be the well-known debug SHA-1 (`5E:8F:16:06:…`). Use the new SHA-1
to restrict the Google Maps API key (owner checklist in `docs/epics/EPIC-010-...md` §7).
