# Research: Mobile Power Features

## 1. Push Notifications
**Decision**: Use `expo-notifications` for client-side token registration and handling, and send tokens to the Rust API for storage.
**Rationale**: `expo-notifications` provides a unified API for iOS and Android push notifications and handles the complexities of requesting permissions and receiving foreground/background notifications.
**Alternatives considered**: Firebase Cloud Messaging directly, but it requires more native configuration than Expo's unified service.

## 2. Native 'Share To' Integration
**Decision**: Use `expo-share-intent` community plugin.
**Rationale**: It provides a native module wrapper that makes the app appear in the system share sheet on both iOS and Android, and passes the shared URL/Text directly into the React Native context without needing to write custom iOS App Extensions or Android Activities manually.
**Alternatives considered**: Writing a custom iOS Share Extension in Swift and Android Intent filter in Java, which is overly complex and harder to maintain in a pure Expo project.

## 3. Native Camera & Media Editor
**Decision**: Use `expo-camera` for capture and `expo-image-manipulator` for basic cropping/editing.
**Rationale**: Both are officially maintained Expo modules that integrate seamlessly with the Expo managed workflow and provide the necessary UI hooks and image processing capabilities required by the spec.
**Alternatives considered**: `react-native-vision-camera`, which is more powerful but heavier and requires more configuration, overkill for basic social media photos.

## 4. Offline Drafts & Sync
**Decision**: Use `@react-native-async-storage/async-storage` for local persistence.
**Rationale**: It is already installed in the project (used in `themeStore.tsx`) and is sufficient for storing an array of JSON draft objects. We can use `NetInfo` (from `@react-native-community/netinfo`) to detect when the network comes back online to trigger the sync to the Rust API.
**Alternatives considered**: WatermelonDB or SQLite, which offer more robust querying but are much heavier dependencies for a simple drafts list.

## 5. Home Screen Widgets
**Decision**: Defer native widgets or use a community plugin like `react-native-widget-extension`.
**Rationale**: Expo does not have a built-in first-party library for home screen widgets that display dynamic data. A custom config plugin or a 3rd party library is needed. For this feature, we will outline the contract, but it will require native iOS/Android code via config plugins.
**Alternatives considered**: Expo's upcoming widget support (still experimental/beta).
