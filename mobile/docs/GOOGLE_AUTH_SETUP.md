# Setting Up Native Google Authentication for Android

To provide the best user experience (the native Google slide-up sheet instead of a web browser redirect), you need to create an Android OAuth Client ID in your Google Cloud Console. 

Follow these steps exactly to generate the Client IDs for both **Production (APK)** and **Development (Expo Go)**.

## Step 1: Get Your SHA-1 Fingerprints

Google needs to verify that the app making the login request is genuinely your app. It does this by checking the SHA-1 fingerprint of the certificate used to sign your app.

**For your Production APK (EAS Build):**
1. Open your terminal in the `mobile` folder.
2. Run this command to view your EAS build credentials:
   ```bash
   eas credentials
   ```
3. Select **Android** → **production** (or `apk` profile) → your keystore.
4. It will print out a **SHA-1 Certificate Fingerprint** (it looks like `A1:B2:C3:...`). **Copy this.**

## Step 2: Create the Client ID in Google Cloud Console

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and ensure you are in the same project you used to create your Web Client ID (`368369715835-...`).
2. In the left sidebar, click **APIs & Services** → **Credentials**.
3. Click **+ CREATE CREDENTIALS** at the top and select **OAuth client ID**.
4. Set the **Application type** to **Android**.
5. Set the **Name** to something like `Mako Android App (Production)`.
6. Under **Package name**, enter exactly:
   ```text
   com.tekrem.mako
   ```
   *(This is the package name defined in your app.json)*
7. Under **SHA-1 certificate fingerprint**, paste the SHA-1 you copied from the `eas credentials` step above.
8. Click **CREATE**.
9. A popup will appear with your new **Client ID**. Copy this Client ID.

## Step 3: Update your Environment Variables

1. Open your `mobile/.env` file.
2. Paste the new Client ID you just created into the Android variable:
   ```env
   EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=your-new-android-client-id.apps.googleusercontent.com
   ```

---

## (Optional) Step 4: Testing in Expo Go

If you want the native login to work while testing inside the **Expo Go** app on your phone, you have to create a *second* Android Client ID specifically for Expo Go.

1. Go back to Google Cloud Console and click **+ CREATE CREDENTIALS** → **OAuth client ID**.
2. Set the **Application type** to **Android**.
3. Set the **Name** to `Mako Android (Expo Go)`.
4. Under **Package name**, enter exactly:
   ```text
   host.exp.exponent
   ```
5. Leave the SHA-1 field blank (or if it requires one, you'll need to grab the debug keystore SHA-1, but usually Expo handles this proxy).
6. Copy the resulting Client ID. 
7. You actually put *this* Client ID in your `.env` when you are testing locally with `yarn start`. When you build for production, you swap it back to the Production one (or use Expo's `app.json` scheme to handle multiple).

*Note: Because setting up Native Auth in Expo Go can be finicky due to package name mismatches, many developers just rely on the Web Redirect flow (what you have right now) for local development, and reserve the Native Client ID exclusively for the actual APK/production build.*

## Step 5: Build a new APK

Since environment variables and native modules are baked into the app during the build process, you must create a new APK for this to take effect:

```bash
yarn build:android
```

Once the new APK is installed, tapping "Continue with Google" will instantly pop up the smooth, native Google account selector!
