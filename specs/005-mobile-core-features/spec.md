# Feature Specification: Mobile Core Features

**Feature Branch**: `005-mobile-core-features`

**Created**: 2026-08-27

**Status**: Draft

**Input**: User description: "i need you to add them to the mobile app"

## User Scenarios & Testing *(mandatory)*

Context: The mobile app already supports sign-in, sign-up, session restore, workspace selection, and a basic profile. A recent review found reliability gaps in session routing and sign-in error handling, and confirmed that most day-to-day Mako product capabilities available on the web are still missing on mobile. This feature delivers a usable on-the-go core: fix those reliability gaps, then add the primary social content workflows marketers need away from a desktop.

### User Story 1 - Reliable session and sign-in (Priority: P1)

A returning user opens the app and reaches their home workspace without getting stuck. A user who mistypes a password sees a clear credentials error—not a false “session expired” message—and can try again.

**Why this priority**: Without reliable auth and cold-start routing, no other mobile feature is usable.

**Independent Test**: Sign in with valid credentials; kill and reopen the app and land on home; attempt invalid credentials and confirm the error message.

**Acceptance Scenarios**:

1. **Given** a user has a valid saved session, **When** they reopen the app, **Then** they reach the main home experience without remaining on an indefinite loading screen.
2. **Given** a user is on the login screen, **When** they submit incorrect credentials, **Then** they see a clear authentication failure message and remain able to retry (they are not signed out of an unrelated session or told the session expired unless that is actually true).
3. **Given** a user signs out, **When** another user signs in on the same device, **Then** the previous user’s profile and workspace data are not shown.

---

### User Story 2 - Create and publish content on the go (Priority: P1)

A marketer with an active workspace drafts a social post on their phone (copy and optional media), chooses connected destinations, and publishes or schedules it. They can open existing drafts and see publish success or failure per destination.

**Why this priority**: Content creation and publishing is the core reason to use Mako; without it, mobile only shows account scaffolding.

**Independent Test**: Create a draft, attach media if available, publish to at least one connected channel, and verify status in the app.

**Acceptance Scenarios**:

1. **Given** an authenticated user with an active workspace, **When** they create a new post with text (and optional media), **Then** the draft is saved in that workspace.
2. **Given** a draft and at least one connected social destination, **When** they publish now, **Then** the app shows per-destination success or a clear failure reason.
3. **Given** a draft, **When** they schedule it for a future time, **Then** the post appears as scheduled and can be reviewed later on mobile.

---

### User Story 3 - Connect social accounts (Priority: P2)

A user connects (or reconnects) social destinations from mobile so publishing and inbox features work for that workspace, using the same account-linking intent as on the web.

**Why this priority**: Publishing depends on connected accounts; many users will set up or repair connections away from a desk.

**Independent Test**: Start a connect flow for a supported network, complete authorization, and see the account listed as connected for the active workspace.

**Acceptance Scenarios**:

1. **Given** an active workspace, **When** the user starts connecting a supported social network, **Then** they complete provider authorization and return to the app with the account shown as connected.
2. **Given** a connected account, **When** the user disconnects it, **Then** it no longer appears as available for publish for that workspace.

---

### User Story 4 - Reply from social inbox (Priority: P2)

A user reviews comments or messages from connected channels in one inbox and sends a reply from the phone.

**Why this priority**: After publish, engagement is the next daily habit; mobile is a natural place to respond quickly.

**Independent Test**: Open inbox for a workspace with recent comments or messages, send a reply, and confirm it appears as sent (or shows a clear error).

**Acceptance Scenarios**:

1. **Given** connected channels with inbound comments or messages, **When** the user opens Social Inbox, **Then** conversations for the active workspace are listed.
2. **Given** a conversation the user can reply to, **When** they send a reply, **Then** the reply is submitted and the thread updates, or a clear error is shown.

---

### User Story 5 - See today’s schedule (Priority: P3)

A user opens a mobile schedule view to see what is planned to publish today or soon, and can open an item to adjust or publish early when allowed.

**Why this priority**: Useful for field checks, but secondary to drafting, connecting, and replying.

**Independent Test**: With scheduled posts in the workspace, open the schedule view and confirm items appear with times and statuses.

**Acceptance Scenarios**:

1. **Given** scheduled posts in the active workspace, **When** the user opens the schedule view, **Then** upcoming items are visible with time and status.
2. **Given** a scheduled item the user is allowed to change, **When** they open it, **Then** they can view details and perform the same allowed actions offered for that item on mobile (at minimum: view and cancel or publish-now if the product already allows those actions for their role).

---

### Edge Cases

- User loses connectivity while drafting, publishing, or replying: show a clear offline or timeout message; do not claim success.
- Access token expires mid-session: refresh silently when possible; otherwise return the user to sign-in with a clear message.
- Workspace has no connected accounts when the user tries to publish: block publish with guidance to connect accounts first.
- User switches workspace: lists and actions only show data for the newly selected workspace.
- Provider authorization is cancelled mid-connect: return to Connections without marking the account connected.
- Release scope is **core social ops only** (session reliability, content, connections, inbox, schedule). WhatsApp hub, Ads, Brand Brain, Analytics, Team, Billing, Mail, and Chatbot are deferred.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST route returning authenticated users into the main app experience on cold start (no stuck loading-only screen when a valid session exists).
- **FR-002**: System MUST treat sign-in, sign-up, and social sign-in failures as credential or provider errors, distinct from session-expiry handling.
- **FR-003**: System MUST clear prior user-visible data from the device session when a user signs out or a different user signs in.
- **FR-004**: System MUST allow users to create, edit, and save content drafts scoped to the active workspace.
- **FR-005**: System MUST allow users to publish or schedule drafts to connected destinations and show per-destination outcomes.
- **FR-006**: System MUST allow users to connect and disconnect supported social accounts for the active workspace from mobile.
- **FR-007**: System MUST provide a social inbox where users can view and reply to comments or messages for the active workspace where the product already supports those actions.
- **FR-008**: System MUST provide a schedule view of upcoming posts for the active workspace.
- **FR-009**: System MUST enforce tenant and workspace isolation for all mobile reads and writes (Constitution II).
- **FR-010**: System MUST use the live production API behavior for these features (Constitution I — Rust runtime).
- **FR-011**: System MUST show user-friendly messages for offline conditions, timeouts, and permission denials.
- **FR-012**: System MUST respect the user’s role permissions (users without publish or reply rights must not be able to perform those actions).
- **FR-013**: System MUST NOT introduce new secret material into the repository or client binaries beyond existing public client configuration patterns (Constitution III).
- **FR-014**: Deferred modules (Ads, Brand Brain deep editing, Analytics/Reports, Team admin, Billing, Mail, Chatbot/Knowledge, WhatsApp hub beyond unified inbox items, Export, back-office) MUST remain out of this feature’s acceptance criteria.

### Key Entities

- **User Session**: Authenticated mobile session (access + refresh), cleared on sign-out.
- **Workspace**: Active context for all content, connections, inbox, and schedule data.
- **Content Draft / Post**: Text and media intended for one or more social destinations; statuses include draft, scheduled, published, failed.
- **Connected Account**: Social destination linked to a workspace for publish and inbox.
- **Inbox Conversation**: Comment thread or message thread tied to a connected channel and workspace.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of test runs with a valid saved session reach the main home experience within 5 seconds of cold start on a stable connection (no indefinite spinner).
- **SC-002**: Users can create a simple text draft and publish it to one connected destination in under 3 minutes on a stable connection.
- **SC-003**: Invalid password attempts show a credentials-related error in 100% of tested cases (never a false “session expired” when no prior session existed).
- **SC-004**: After workspace switch, subsequent content, inbox, and schedule views show only that workspace’s data in 100% of manual isolation checks.
- **SC-005**: At least 90% of testers complete connect → draft → publish → inbox reply happy path without assistance when accounts are pre-provisioned.

## Assumptions

- “Them” refers to the remaining mobile gaps identified in review: reliability fixes plus core product workflows still missing versus the web app.
- Default **in scope** for this feature: session/auth reliability, content draft/publish/schedule, social Connections, Social Inbox replies, and schedule viewing—aligned with existing Mako user guides for getting started, managing content, and after-you-publish.
- **Out of scope** (confirmed for this release): Ads, Brand Brain deep editing, Analytics/Reports, Team/permissions admin, Billing, Mail, Chatbot/Knowledge, WhatsApp hub/templates beyond inbox items already unified in Social Inbox, Export, and back-office/admin tools.
- Mobile reuses the same backend identity, tenancy, and publishing capabilities as the web app; no new backend product domains are required beyond what the live API already supports for those flows.
- Push notifications are out of scope for this release (users open the app to check inbox/schedule).
- Media capture/upload on mobile is included at a basic level (pick existing photos/videos); advanced media library management can remain web-first.
- Design should stay consistent with the existing Wise-inspired mobile tokens already introduced in the first mobile feature.
