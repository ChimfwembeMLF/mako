# Mako Mobile — TestFlight

## Prerequisites

1. **Apple Developer Program** ($99/yr) with access to App Store Connect.
2. **Expo account** — [expo.dev/signup](https://expo.dev/signup).
3. **Bundle ID** `com.tekrem.mako` registered in Apple Developer → Identifiers (EAS can create it on first build if your Apple login has permission).

## One-time setup

From repo root:

```bash
yarn install
cd mobile
```

Log in to Expo (opens browser):

```bash
yarn eas login
```

Link the app to an EAS project (creates `expo.extra.eas.projectId` in `app.json`):

```bash
yarn eas init
```

Set production public env vars on EAS (`.env` is not uploaded). Required for Google sign-in on device builds:

```bash
yarn eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID --value "YOUR_WEB_CLIENT_ID.apps.googleusercontent.com"
```

Or add the same key under `build.production.env` in `eas.json` (client IDs are public).

## Build for TestFlight

```bash
cd mobile
yarn build:ios
```

- Profile: **production** (`distribution: store`, auto-increment build number).
- API URL is baked in: `https://mako.tekreminnovations.com`.
- First run prompts for **Apple ID** + app-specific password or ASC API key — EAS stores credentials for later builds.

When the cloud build finishes, download the `.ipa` link from the Expo dashboard or CLI output.

## Submit to TestFlight

After a successful production iOS build:

```bash
yarn submit:ios
```

Or combine build + submit:

```bash
yarn eas build --platform ios --profile production --auto-submit
```

Then in **App Store Connect → TestFlight**:

1. Wait for “Processing” to complete (often 5–15 minutes).
2. Add **internal testers** (same Apple team) or **external testers** (requires brief Beta App Review for first external group).
3. Install **TestFlight** on iPhone and accept the invite.

## Verify on device

1. Sign in with email/password or Google (uses production API OAuth — no extra Google redirect URI beyond `/api/v1/auth/google/redirect`).
2. Connect a social account (OAuth → `mako://` / publisher callback).
3. Create draft → schedule → inbox sync.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Not logged in` | `yarn eas login` |
| Missing `projectId` | `yarn eas init` |
| Google sign-in fails on TestFlight build | Set `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` via EAS secret or `eas.json` env |
| Apple credentials | `yarn eas credentials` |
| Build number conflict | EAS `autoIncrement` + `appVersionSource: remote` handles this |

## Profiles (`eas.json`)

| Profile | Use |
|---------|-----|
| `development` | Dev client + simulator |
| `preview` | Internal ad-hoc (team devices, not TestFlight) |
| `production` | App Store / **TestFlight** |
