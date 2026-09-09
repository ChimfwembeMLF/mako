# Feature Specification: Mobile Power Features

**Feature Branch**: `[009-mobile-power-features]`

**Created**: 2026-09-09

**Status**: Draft

**Input**: User description: "implement the above: 1. Push Notifications 2. Native 'Share To' Integration 3. Native Camera & Media Editor 4. Offline Drafts & Sync 5. Home Screen Widgets"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Push Notifications (Priority: P1)

As a mobile user, I want to receive push notifications for important social events (DMs, mentions, publishing failures), so that I can respond immediately without keeping the app open.

**Why this priority**: Core engagement and timely response are the primary reasons users install mobile companion apps.
**Independent Test**: Can be tested independently by triggering events from the backend and observing the notification arriving on the physical device.

**Acceptance Scenarios**:
1. **Given** the user is opted in to push notifications, **When** a critical event occurs (e.g. failed post), **Then** a push notification is delivered to their device.
2. **Given** the user taps the push notification, **When** the app opens, **Then** it navigates them directly to the relevant screen (deep linking).

---

### User Story 2 - Native 'Share To' Integration (Priority: P2)

As a content creator, I want the Mako app to appear in my phone's native share sheet, so that I can instantly share links or photos from other apps into the Content Engine.

**Why this priority**: Greatly reduces friction for content creation on mobile devices.
**Independent Test**: Can be tested independently by opening a web browser, tapping Share, and selecting Mako.

**Acceptance Scenarios**:
1. **Given** the user is in Safari/Chrome, **When** they tap Share and select Mako, **Then** the app opens the Content Engine with the shared URL populated in the composer.

---

### User Story 3 - Offline Drafts & Sync (Priority: P2)

As a mobile user in transit, I want to be able to compose and save post drafts even when offline, and have them automatically sync when I regain connection, so I never lose my work.

**Why this priority**: Mobile connectivity is unreliable. Preventing data loss builds trust.
**Independent Test**: Can be tested independently by turning on Airplane mode, writing a draft, turning Airplane mode off, and verifying the draft appears on the web app.

**Acceptance Scenarios**:
1. **Given** the user has no internet connection, **When** they write and save a draft, **Then** it is stored locally.
2. **Given** the user regains connectivity, **When** the app detects the connection, **Then** local drafts are automatically synced to the server.

---

### User Story 4 - Native Camera & Media Editor (Priority: P3)

As a social media manager, I want to take photos/videos directly within the app and apply basic crops/filters before scheduling, so that I can quickly cover live events.

**Why this priority**: Reduces the need to switch between the camera app, photo gallery, and Mako app.
**Independent Test**: Can be tested independently by tapping the camera icon in the composer, capturing an image, and seeing it attached to the draft.

**Acceptance Scenarios**:
1. **Given** the user is drafting a post, **When** they tap the Camera icon, **Then** the native camera UI opens.
2. **Given** the user captures an image, **When** they accept it, **Then** they can crop it and attach it to the post.

---

### User Story 5 - Home Screen Widgets (Priority: P4)

As a user, I want iOS/Android widgets to display my upcoming scheduled posts on my phone's home screen, so that I can view my daily pipeline at a glance.

**Why this priority**: Improves passive engagement, though it's a "nice-to-have" compared to core functionality.
**Independent Test**: Can be tested independently by adding the widget to the home screen and verifying it accurately reflects the day's schedule.

**Acceptance Scenarios**:
1. **Given** the user adds the Mako widget to their home screen, **When** they view it, **Then** it displays the next 3 upcoming posts.

### Edge Cases

- What happens if a user revokes push notification permissions at the OS level?
- How does the system resolve conflicts if an offline draft is edited simultaneously on the web app?
- What happens if the native share sheet passes an unsupported file type?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST register devices for push notifications (e.g., via Expo Push Services) and securely store push tokens per user/device.
- **FR-002**: System MUST deliver push notifications for critical events (inbox messages, approvals, publishing errors).
- **FR-003**: System MUST support deep linking from push notifications to specific app screens.
- **FR-004**: System MUST register as a native Share Target for URLs and Images on iOS and Android.
- **FR-005**: System MUST provide an offline storage mechanism for content drafts.
- **FR-006**: System MUST automatically sync offline drafts to the backend upon detecting network restoration.
- **FR-007**: System MUST provide a native camera interface for capturing media directly in the composer.
- **FR-008**: System MUST provide basic cropping capabilities for captured media.
- **FR-009**: System MUST provide a home screen widget (iOS/Android) that displays upcoming scheduled posts.
- **FR-010**: When the feature touches the live API, System MUST behave correctly on the Rust runtime (`api-rust`) unless the spec explicitly scopes Nest-only work.
- **FR-011**: When the feature stores tenant or workspace data, System MUST enforce tenant/workspace isolation and RBAC.

### Key Entities

- **DevicePushToken**: Represents a push notification token mapped to a specific User and Device.
- **LocalDraft**: Represents an unsynced post draft stored on the device.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Push notifications are delivered within 5 seconds of the backend event triggering.
- **SC-002**: 100% of offline drafts are successfully synced to the backend within 60 seconds of network restoration.
- **SC-003**: 'Share To' action opens the composer and hydrates the content in under 2 seconds.
- **SC-004**: Users can capture, crop, and attach a photo in under 15 seconds.

## Assumptions

- We are utilizing Expo Push Notifications for simplified cross-platform delivery.
- Offline sync strategy will use a "last write wins" approach for simplicity in v1.
- Expo's native modules (e.g., `expo-camera`, `expo-image-manipulator`, `expo-sharing`) will be sufficient to cover native integration requirements.
- Home screen widgets will be implemented using Expo's widget tooling or native modules that bridge React Native data.
