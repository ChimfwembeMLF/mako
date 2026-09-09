# Quickstart Validation Guide: Mobile Power Features

## Prerequisites
- React Native environment setup (Expo)
- iOS Simulator or Android Emulator running
- Rust API backend running locally (`dokploy` or `cargo run`)

## Validation Scenarios

### 1. Push Notification Token Registration
**Setup**: Run the mobile app (`yarn ios` or `yarn android`).
**Test**: Log in to the mobile app. Open the terminal running the Rust API.
**Expected**: The API logs should show a request to `POST /api/v1/users/push-tokens` with an Expo push token.

### 2. Offline Drafts Sync
**Setup**: Turn off WiFi/Data on the emulator. Open the Mako app and navigate to the Content Engine.
**Test**: Write a draft post and tap "Save".
**Expected**: The draft appears in the list. Restarting the app while offline retains the draft.
**Test 2**: Turn WiFi/Data back on.
**Expected**: The app detects the connection and automatically uploads the draft to the backend, removing it from the local offline queue.

### 3. Camera Capture
**Setup**: Run on a physical device via Expo Go (Simulators cannot fully test camera).
**Test**: Open Content Engine -> Tap Camera icon.
**Expected**: Camera view opens. Taking a picture returns to the composer with the image attached.

### 4. Share Intent
**Setup**: Run on an Android emulator or iOS simulator.
**Test**: Open the native web browser (Chrome/Safari). Go to a news article. Tap "Share". Select the Mako app.
**Expected**: Mako app opens directly to the Content Engine composer, with the URL of the article pre-filled in the text box.
