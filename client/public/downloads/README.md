# Android APK for website download (`/downloads/mako.apk`)

Build and publish from repo root:

```bash
cd mobile
yarn eas login    # once
yarn eas init     # once
yarn publish:apk  # cloud build + download into this folder
```

Then deploy the web client so `https://mako.tekreminnovations.com/downloads/mako.apk` is served from `client/public/downloads/mako.apk`.

**Do not commit** large `.apk` binaries — they are gitignored. CI/deploy should run `publish:apk` or copy the artifact from EAS.
