# Phase 1: Quickstart Validation Guide

This guide describes how to validate the mobile application setup.

## Prerequisites

1. Ensure you have Node.js and Yarn installed.
2. Ensure the Rust API is running (`docker compose up api` or running natively in `api-rust/`).
3. Install the **Expo Go** app on your physical iOS or Android device, or have an iOS Simulator / Android Emulator running on your machine.

## Setup Commands

Run these commands from the repository root:

```bash
# Navigate to the mobile workspace
cd mobile

# Install dependencies (assuming Yarn workspaces is configured)
yarn install

# Start the Expo development server
npx expo start
```

## Validation Scenarios

### Scenario 1: App Boot & UI Check
1. Scan the QR code in the terminal with your phone's camera (iOS) or the Expo Go app (Android), OR press `i` for iOS simulator / `a` for Android emulator.
2. **Expected Outcome**: The app builds and displays the initial login screen. The screen should have a Sage-tinted background (`#e8ebe6`) and a Lime-green (`#9fe870`) primary button, confirming the design system tokens are active.

### Scenario 2: Authentication
1. Enter valid credentials (matching an account in your local database) and tap "Sign In".
2. **Expected Outcome**: The app communicates with the local `api-rust` backend, successfully authenticates, and navigates to the Home Screen. 

### Scenario 3: Offline Handling
1. While logged in, disable WiFi/cellular data on your device/simulator.
2. Pull to refresh or attempt an action.
3. **Expected Outcome**: A graceful error message (e.g., "Please check your internet connection") appears without crashing the app.
