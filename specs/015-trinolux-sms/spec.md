# Feature Specification: Trinolux SMS Integration

**Feature Branch**: `[015-trinolux-sms]`

**Created**: 2026-11-01

**Status**: Foundation built; customer SMS out of scope for now

**Input**: User description: "we need https://sms.trinolux.com/ integrated into the system"

**Scope decision (2026-11-01)**: "for now just enable for mako". SMS is for Mako's own platform account only. Tenants cannot send, so User Stories 2 and 3 are deferred, and Q1 and Q2 no longer block this release.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Platform SMS Foundation (Priority: P1)

As a platform admin, I want to add Mako's Trinolux API key and Sender ID in Platform Backoffice and send a test message, so that I can confirm SMS works before any customer feature depends on it.

**Why this priority**: Every SMS feature depends on it, and it exposes no tenant-facing cost.

**Independent Test**: Save valid settings in Platform Backoffice, send a test SMS to a Zambian number, and confirm Mako reports that Trinolux accepted it.

**Acceptance Scenarios**:
1. **Given** SMS is not configured, **When** an admin sends a test, **Then** Mako explains what is missing and makes no provider request.
2. **Given** valid settings, **When** an admin sends a test, **Then** Mako shows that the message was accepted, and does not claim it was delivered.
3. **Given** an invalid key or low balance, **When** an admin sends a test, **Then** Mako shows a clear reason and does not retry.
4. **Given** a non-admin, **When** they call the test endpoint, **Then** the request is refused.

---

### User Story 2 - Send an SMS to a Lead (Deferred)

As a team member with permission, I want to text a lead from their record, so that I can follow up with people who don't answer email.

**Why this priority**: First customer-facing use of phone numbers Mako already holds. Blocked on Q1 and Q2.

**Independent Test**: Open a lead with a phone number, send a message, and see it in that lead's history as accepted.

**Acceptance Scenarios**:
1. **Given** a lead has a valid number, **When** a permitted user sends a message, **Then** it is sent once and recorded against the tenant and lead.
2. **Given** a message over the limit, **When** the user tries to send, **Then** Mako blocks it and shows the character count.
3. **Given** the tenant has used its SMS allowance, **When** a user sends, **Then** Mako refuses before contacting Trinolux.
4. **Given** a user from another tenant, **When** they try to text this lead, **Then** the request is refused.

---

### User Story 3 - Delivery Status (Deferred)

As a sender, I want to see whether a message was delivered, so that I can tell acceptance apart from a real result.

**Why this priority**: Valuable, but the API key cannot read status. Blocked on Q3.

**Independent Test**: Send a message and watch its status move from Queued to a final state.

**Acceptance Scenarios**:
1. **Given** a recorded message, **When** Trinolux reports a final status, **Then** Mako shows Delivered, Failed, Cancelled or DeliveryUnknown.
2. **Given** DeliveryUnknown, **When** the user views it, **Then** Mako does not resend it automatically.

### Edge Cases

- Timeout after sending: retry with the same idempotency key, so the recipient isn't texted twice.
- Partial acceptance: keep accepted message IDs, and retry only rejected recipients with new keys.
- HTTP 429: wait for `data.retry_after_seconds`, then retry with the same key.
- HTTP 400, 401, 402, 403, 404 and 422: never retry automatically.
- Numbers typed as `0971234567` or `+260971234567`: normalise to `260971234567`.
- Non-Zambian numbers: reject before sending, because the service is Zambia only.
- Messages over 160 characters: reject before sending.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST send SMS only from the server, and MUST NOT expose the API key to the website, mobile app or logs.
- **FR-002**: System MUST read `TRINOLUX_API_KEY` and `TRINOLUX_SENDER_ID` through encrypted platform integrations, with environment fallback.
- **FR-003**: System MUST send an `Idempotency-Key` with every send, and reuse it on every retry of that send.
- **FR-004**: System MUST retry only HTTP 429, 5xx and timeouts, within a fixed limit.
- **FR-005**: System MUST treat Queued and Sent as accepted, never as delivered.
- **FR-006**: System MUST normalise recipients to Zambian country-code format, and reject invalid numbers before sending.
- **FR-007**: System MUST reject empty messages and messages over 160 characters before sending.
- **FR-008**: System MUST NOT log message text or full phone numbers.
- **FR-009**: Test sends MUST be limited to platform admins.
- **FR-010**: Customer-facing sends MUST enforce tenant isolation, a permission and a usage allowance before contacting Trinolux.
- **FR-011**: System MUST record each customer-facing send with tenant, sender, recipient, provider message ID and status.

### Key Entities

- **SmsMessage** (User Story 2 onward): one recipient's message, owned by a tenant, with provider ID, status and idempotency key.

## Success Criteria *(mandatory)*

- **SC-001**: An admin can configure SMS and complete a test send in under 5 minutes.
- **SC-002**: A retried send never produces a second SMS.
- **SC-003**: The API key appears in no client bundle, response or log.
- **SC-004**: No tenant can send through, or view messages of, another tenant.

## Open Questions

- **Q1 - Use cases**: which come first after the foundation: lead messages, login codes, reminders to users, or bulk campaigns?
- **Q2 - Who pays**: does Mako absorb SMS costs, include an allowance per plan, sell credits, or let tenants use their own Trinolux key and Sender ID?
- **Q3 - Delivery status**: read endpoints need a Bearer token and no webhook is documented. Does Trinolux offer delivery callbacks or a service token?
- **Q4 - Message length**: can Trinolux send over 160 characters, for example as multipart?

## Assumptions

- User Story 1 needs no database change.
- Only Zambian recipients are supported, because Trinolux currently serves only Zambia.
