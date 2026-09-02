# Feature Specification: Mobile Core Hardening

**Feature Branch**: `006-mobile-core-hardening`

**Created**: 2026-08-27

**Status**: Draft

**Input**: User description: "005 mobile core is converged; harden remaining HIGH/MEDIUM bugs and close product gaps vs web (reply truthfulness, save-before-publish, media attach reliability, comment inbox parity, destination alignment, broader social connect, schedule/media UX polish). Deferred megas stay out of scope."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Trustworthy replies and publishes (Priority: P1)

A marketer replies from the inbox and publishes an edited draft from the phone. When a reply cannot be delivered, they see a clear failure—not a cleared composer that looks like success. When they change copy on an existing draft and tap publish, the published post matches what they just edited.

**Why this priority**: False success and stale publishes destroy trust in the mobile core that 005 already shipped.

**Independent Test**: (1) Force a reply soft-failure and confirm the composer is not cleared and an error is shown. (2) Edit an existing draft’s text, publish without a separate save tap, and confirm the live/queued post uses the edited text.

**Acceptance Scenarios**:

1. **Given** a conversation where the product cannot send a reply, **When** the user sends a reply, **Then** they see a clear failure message, the draft text remains available to retry or edit, and the thread does not imply success.
2. **Given** a conversation where a reply succeeds, **When** the user sends a reply, **Then** the composer clears and the thread updates (or shows a clear error if the refresh fails).
3. **Given** an existing draft open with unsaved title/body/destination changes, **When** the user publishes now, **Then** those changes are included in what is published (or the user is blocked with a clear reason before publish proceeds).
4. **Given** a draft with no connected destinations for the selected networks, **When** the user tries to publish, **Then** they are guided to connect or change destinations rather than receiving a surprising post-publish failure.

---

### User Story 2 - Reliable media attach on device (Priority: P1)

A user attaches a photo from the device library while drafting. The app asks for needed library access, the picker works after dependencies are installed, and an expired session during upload recovers the same way other authenticated actions do—or shows a clear sign-in/offline message.

**Why this priority**: Media attach is part of the core create/publish journey; a broken picker or silent upload failure blocks the happy path.

**Independent Test**: On a device build with dependencies installed, grant library access, attach an image to a draft, and confirm it appears on the draft; with an expired access token, confirm upload either recovers silently or prompts clearly without a cryptic failure.

**Acceptance Scenarios**:

1. **Given** the mobile app is installed with required media capabilities available, **When** the user chooses to add an image, **Then** they can pick from the library (after granting permission if required) and see a preview on the draft.
2. **Given** library permission is denied, **When** the user tries to add an image, **Then** they see a clear explanation and how to enable access—not a silent no-op.
3. **Given** the user’s access session has expired but refresh is still possible, **When** they upload media, **Then** the upload succeeds after recovery or they are clearly asked to sign in again.

---

### User Story 3 - Inbox parity for comments and messages (Priority: P2)

A user opens Social Inbox on mobile and sees both direct messages and post comments for the active workspace (where the product already supports them on web), and can reply to comment threads with the same truthful success/failure behavior as direct messages.

**Why this priority**: 005 delivered DM-only inbox; marketers expect comments and messages in one place as on web.

**Independent Test**: With both DMs and post comments present for a workspace, open mobile inbox, open a comment thread, reply, and confirm success or a clear failure.

**Acceptance Scenarios**:

1. **Given** connected channels with inbound comments and messages, **When** the user opens Social Inbox, **Then** both kinds of conversations for the active workspace are listed (or clearly labeled if a type is temporarily unavailable).
2. **Given** a comment thread the user can reply to, **When** they send a reply, **Then** the reply is submitted and the thread updates, or a clear error is shown without implying success.

---

### User Story 4 - Destinations match what’s connected (Priority: P2)

When drafting, the user only chooses destinations that are actually connected for the workspace (or clearly sees which selections are unavailable). They can also connect additional networks that web already supports for publishing, beyond the current Facebook / Instagram / LinkedIn set, where the product already has connect flows.

**Why this priority**: Selecting disconnected networks causes late publish failures; expanding connect closes a gap versus web.

**Independent Test**: Connect only Facebook; open the editor and confirm other networks are not freely selectable as publishable; start connect for a web-supported additional network and see it listed when complete.

**Acceptance Scenarios**:

1. **Given** a workspace with a subset of networks connected, **When** the user opens the content editor, **Then** publish destinations reflect connected accounts (unavailable networks are disabled or hidden with guidance).
2. **Given** an active workspace, **When** the user connects a supported additional network that web already offers for publishing, **Then** the account appears as connected and becomes selectable for publish.
3. **Given** Google sign-in is not configured on the device build, **When** the user tries Google sign-in, **Then** they see a clear configuration error—not a cryptic failure from placeholder credentials.

---

### User Story 5 - Schedule and draft polish (Priority: P3)

A user reviewing the schedule can cancel a scheduled post explicitly, see existing media when editing a draft, and complete recorded device checks of the core happy path so the team knows cold start, auth errors, connect, publish, and inbox work on a real device.

**Why this priority**: Improves daily usability and closes the unverified QA gap; not required for trust fixes in P1.

**Independent Test**: Cancel a scheduled item from mobile; reopen a draft that already has media and see it; run and record the mobile quickstart scenarios on a device.

**Acceptance Scenarios**:

1. **Given** a scheduled post the user may change, **When** they cancel the schedule on mobile, **Then** it is no longer listed as scheduled and returns to an appropriate draft/non-scheduled state.
2. **Given** a draft that already has attached media, **When** they open it on mobile, **Then** existing media is visible (not only newly picked images).
3. **Given** a prepared test workspace, **When** testers run the documented mobile quickstart scenarios on a real device, **Then** results are recorded with pass/fail for each scenario.

---

### Edge Cases

- Reply API returns success-shaped HTTP with an explicit not-sent outcome: treat as failure for the user.
- Publish attempted while offline or timed out: show offline/timeout messaging; do not claim published.
- Session expires during media upload: recover via refresh when possible; otherwise return to sign-in with a clear message.
- User selects destinations that become disconnected mid-edit: block or refresh guidance before publish.
- Provider connect cancelled mid-flow: return to Connections without marking connected.
- User lacks create/edit rights: hide or disable draft mutation actions consistently with publish/reply gating (server remains source of truth).
- Workspace switch: inbox and content lists only show the newly selected workspace.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST treat an unsuccessful reply outcome as a failure in the UI (composer retained, error shown), even when the transport response is otherwise “OK.”
- **FR-002**: System MUST apply unsaved draft edits (copy, destinations, schedule fields, and pending media) before or as part of publish-now for existing items, or block publish until the user resolves the save.
- **FR-003**: System MUST make device media picking available in production builds (dependency and permission flows included) and MUST explain denied library access.
- **FR-004**: System MUST recover or clearly fail authenticated media upload when the access session expires mid-action, consistent with other authenticated mobile actions.
- **FR-005**: System MUST list and support reply for post-comment conversations on mobile where the live product already supports them for the workspace (not DM-only).
- **FR-006**: System MUST limit or clearly mark publish destinations to networks that have connected accounts for the active workspace.
- **FR-007**: System MUST allow connecting additional social networks already offered for publishing on web (beyond Facebook, Instagram, and LinkedIn), using the same account-linking intent and workspace scoping.
- **FR-008**: System MUST show existing attached media when opening an editable draft on mobile.
- **FR-009**: System MUST provide an explicit cancel-schedule action for scheduled items the user is allowed to change.
- **FR-010**: System MUST NOT use placeholder Google sign-in credentials; when public Google client configuration is missing, sign-in MUST show a clear configuration error.
- **FR-011**: System MUST respect create/edit permissions in the draft editor UX (not only publish/reply), while still relying on server enforcement.
- **FR-012**: System MUST keep tenant and workspace isolation for all reads and writes touched by this feature.
- **FR-013**: System MUST use live production API behavior for these flows (Rust runtime).
- **FR-014**: System MUST record device quickstart results (pass/fail) for cold start, invalid credentials, connect return, draft/publish, and inbox reply scenarios as part of acceptance of this feature.
- **FR-015**: Deferred modules (Ads, Brand Brain deep editing, Analytics/Reports, Team admin, Billing, Mail, Chatbot/Knowledge, WhatsApp hub/templates beyond unified inbox items, Approvals admin queue, Campaigns, Export, push notifications) MUST remain out of this feature’s acceptance criteria.

### Key Entities

- **Draft / Post**: Editable content with destinations, schedule state, and media attachments.
- **Connected Account**: Social destination linked to a workspace; gates publish destination choices.
- **Inbox Conversation**: Direct message or post-comment thread for a workspace.
- **Reply Outcome**: Explicit success or failure of a send attempt, independent of transport “OK.”
- **Device Session**: Access/refresh session used for authenticated actions including media upload.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of tested unsuccessful reply outcomes, the composer is not cleared and a failure message is visible.
- **SC-002**: In 100% of tested publish-now cases after editing an existing draft’s text, the published or queued content matches the edited text (or publish is blocked with a clear reason before send).
- **SC-003**: Testers can attach a library image to a draft on a real device in under 2 minutes when permission is granted and dependencies are installed.
- **SC-004**: With both comments and DMs present, mobile inbox shows both types in 100% of isolation checks for the active workspace.
- **SC-005**: With only a subset of networks connected, users cannot complete a publish targeting a disconnected network without first connecting or changing destinations, in 100% of tested attempts.
- **SC-006**: Documented quickstart scenarios for this feature are executed on a real device and recorded with pass/fail for each scenario before the feature is marked complete.

## Assumptions

- Builds on the converged `005-mobile-core-features` mobile core; this feature hardens and extends it rather than replacing auth or tab structure.
- “Additional networks” means networks web already exposes for publisher connect/finalize for content publishing; WhatsApp **hub/templates** remain deferred, while WhatsApp as a connectable destination is included only if web already treats it as a publisher connection for the same workspace content flows.
- Approvals queues, campaigns, media library browsing (beyond device library pick), analytics, ads, and team admin are out of scope (next slices / deferred).
- Server remains authoritative for permissions; mobile UX gates are best-effort and must fail closed when permission state is unknown or denied.
- Device QA uses a stable network and a workspace with at least one connected account for publish/inbox scenarios.
- No new backend product domains are required beyond what the live API already supports for web comment inbox, reply outcomes, and social connect.
