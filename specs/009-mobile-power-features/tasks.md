# Implementation Tasks: Mobile Power Features

## Dependencies & Execution Order

1. **Phase 1: Setup** (Expo native plugins installation)
2. **Phase 2: Push Notifications (US1)** 
3. **Phase 3: Share Intent (US2)**
4. **Phase 4: Offline Drafts (US3)**
5. **Phase 5: Camera & Media (US4)**
6. **Phase 6: Home Screen Widgets (US5)**

## Phase 1: Setup

- [x] T001 Install `expo-notifications`, `expo-share-intent`, `expo-camera`, `expo-image-manipulator`, `@react-native-community/netinfo` via package manager in `mobile/package.json`
- [x] T002 Add Expo config plugins for these native modules to `mobile/app.json`

## Phase 2: Push Notifications (US1)

**Goal:** Ensure the backend can register device push tokens and the mobile app can handle incoming push notifications.
**Independent Test:** Use Expo Push Notification tool to send a test message to the device token logged to the console.

- [x] T003 [P] [US1] Create migration for `device_push_tokens` table in `api/database/migrations` (id, user_id, token, platform, created_at, updated_at).
- [x] T004 [P] [US1] Define `DevicePushToken` entity in `api-rust/src/modules/users/entity.rs`.
- [x] T005 [P] [US1] Create `POST /api/v1/users/push-tokens` endpoint in `api-rust/src/modules/users/mod.rs` to save/update the push token.
- [x] T006 [US1] Create `usePushNotifications` hook in `mobile/src/hooks/usePushNotifications.ts` to request permissions, get token, and POST to backend.
- [x] T007 [US1] Initialize `usePushNotifications` in `mobile/app/_layout.tsx` when user is logged in.

## Phase 3: Native Share Intent (US2)

**Goal:** Enable Mako as a native Share Target for iOS/Android, deep linking into the Content Engine.
**Independent Test:** Share a URL from native Chrome/Safari and verify it populates the Mako composer.

- [x] T008 [P] [US2] Update `mobile/app.json` with iOS/Android share intent scheme/bundle identifiers following `expo-share-intent` docs.
- [x] T009 [P] [US2] Setup native intent handler in `mobile/app/+native-intent.ts` to capture shared URLs.
- [x] T010 [US2] Update `mobile/app/(tabs)/content/new.tsx` to read the shared URL param and pre-fill the post text box.

## Phase 4: Offline Drafts & Sync (US3)

**Goal:** Allow users to write and save drafts offline, syncing when connectivity restores.
**Independent Test:** Save draft while offline, reconnect, and observe automatic sync.

- [x] T011 [P] [US3] Create `draftsStore.tsx` in `mobile/src/store/draftsStore.tsx` using Zustand and AsyncStorage to manage the `LocalDraft` array.
- [x] T012 [P] [US3] Integrate `useNetInfo` hook from `@react-native-community/netinfo` inside `mobile/src/components/ContentEditorScreen.tsx` to detect `isConnected`. If offline, use `draftsStore` to save the `LocalDraft` locally instead of making an API call in `handleSave`. Show toast "Saved locally (Offline)".
- [x] T013 [US3] Add a "Local Drafts" section to `mobile/app/(tabs)/content/index.tsx` when `drafts.length > 0`. Add sync logic to push them to the backend when online.
- [x] T014 [US3] Register `OfflineSyncService` hook/listener in `mobile/app/_layout.tsx` to automatically start sync when online.

## Phase 5: Native Camera & Media Editor (US4)

**Goal:** Allow users to take pictures directly in the app and crop them.
**Independent Test:** Tap camera icon, take picture, apply crop, and attach to draft.

- [x] T015 [P] [US4] Create `CameraModal` component in `mobile/src/components/CameraModal.tsx` utilizing `expo-camera`.
- [x] T016 [US4] Add media editing (cropping/filters) via `expo-image-manipulator` after photo capture inside `CameraModal`.
- [x] T017 [US4] Update `mobile/src/components/ContentEditorScreen.tsx` to add an "Open Camera" button that opens `CameraModal` and attaches the edited image to `localImage`.

## Phase 6: Home Screen Widgets (US5)

**Goal:** Add a basic widget to show upcoming posts.
**Independent Test:** Add widget to iOS/Android home screen.

- [x] T018 [P] [US5] Install widget plugin (e.g. `react-native-widget-extension`) and configure in `mobile/app.json`.
- [x] T019 [US5] Add `mobile/widgets/QuickDraftWidget.swift` (iOS) and/or Android equivalent to provide a shortcut to the app's `new post` deep link.
- [x] T020 [US5] Register the widget deep link in `mobile/app/+native-intent.ts` or standard linking config to route to `/(tabs)/content/new`.

## Phase 7: Polish & Review

- [ ] T020 Run TypeScript compiler and fix any strict errors (`yarn tsc`).
- [ ] T021 Run smoke tests for push token backend endpoint.

## Phase 8: Convergence

- [x] T022 Implement Expo push notification delivery in Rust backend to send notifications on critical events per FR-002 (missing)
- [x] T023 Implement deep linking logic inside `Notifications.addNotificationResponseReceivedListener` in `usePushNotifications.ts` to navigate to specific app screens per FR-003 (missing)
