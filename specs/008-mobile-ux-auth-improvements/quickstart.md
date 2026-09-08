# Quickstart: Validation Guide

## 1. Validating Native Deep Linking

**Prerequisites**: 
- A physical Android/iOS device with the Expo Go app or a Development Build.
- The native target app (e.g., Meta/Facebook, X) installed and logged in on the device.

**Steps**:
1. Run the app locally using `yarn start` and scan the QR code.
2. Navigate to the social connections screen in the app.
3. Tap "Connect" for a supported social platform (e.g., Google or Meta).
4. **Expected Outcome**: The system should immediately launch the native application's authorization sheet/screen, bypassing the system web browser.
5. Approve the request.
6. **Expected Outcome**: You are redirected back to the Mako app and the connection is successful.

## 2. Validating Dynamic Theming

**Prerequisites**:
- The API backend running locally with the updated `Tenant` table.

**Steps**:
1. Log into the backend (or use an API tool like Postman) and update the `themePrimaryColor` for your test tenant to `#FF0000` (Red).
2. Launch the mobile app and log in as a user belonging to that tenant.
3. **Expected Outcome**: The app's primary buttons, headers, and active tab icons render in Red.
4. Turn off your device's WiFi/Cellular data.
5. Close the app and reopen it.
6. **Expected Outcome**: The app still renders in Red using the cached theme.
