# Android APK — website download

## Build & publish to the website

```bash
cd mobile
yarn eas login   # once
yarn eas init    # once
yarn publish:apk # EAS cloud build + saves APK to client/public/downloads/mako.apk
```

Deploy the web client after publishing so users get:

- Page: `https://mako.tekreminnovations.com/download`
- File: `https://mako.tekreminnovations.com/downloads/mako.apk`

## Profiles

| Profile | Output |
|---------|--------|
| `apk` | Android APK (`buildType: apk`) for direct install |
| `preview` | Same APK + internal distribution metadata |

Production API and Google client ID are set in `eas.json` env.

## Manual download from EAS

If `publish:apk` fails on the download step:

```bash
yarn eas build:download --platform android --latest --output ../client/public/downloads/mako.apk
```

## Override download URL

Set in client env (optional CDN):

```
VITE_MOBILE_APK_URL=https://cdn.example.com/mako.apk
VITE_MOBILE_APK_VERSION=1.0.1
```
