# Feature Specification: Social Media Dashboard (separate product shell)

**Feature Branch**: `003-social-dashboard`

**Created**: 2026-07-24

**Status**: Draft

**Input**: User description: Create a different dashboard for social media not the main dashboard, that way the other one can even have more staff

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Enter Social Dashboard (Priority: P1)

As a tenant member who works on social publishing, I open a dedicated **Social** home that focuses on content, schedule, connections, inbox, and social analytics — not the full marketing suite.

**Why this priority**: Without a separate entry point, social work stays buried in the main dashboard; the main home cannot slim down or specialize for other staff.

**Independent Test**: Sign in → open Social Dashboard route; see social-focused overview and nav; main `/dashboard` remains reachable and unchanged for non-social modules.

**Acceptance Scenarios**:

1. **Given** an authenticated user with content or replies permissions, **When** they navigate to `/social` (or `/social/dashboard`), **Then** they see a social overview (connections status, upcoming posts, inbox highlights) and a social-scoped nav shell.
2. **Given** the same user, **When** they open `/dashboard`, **Then** the main dashboard still loads with the existing general module overview (not replaced by social-only content).
3. **Given** a user lacking all social permissions, **When** they open `/social`, **Then** they are denied or redirected (same RBAC patterns as today).

---

### User Story 2 - Social-scoped navigation (Priority: P1)

As a social operator, the top/side navigation while inside Social shows social product areas (Create content, Scheduler, Connections, Social Inbox, Media, Analytics for social) and hides or de-emphasizes non-social apps (Leads CRM depth, Chatbot admin, Mail, Ads optional later).

**Why this priority**: A separate dashboard without a scoped shell fails the “different dashboard” goal.

**Independent Test**: Inside Social shell, Apps menu lists social groups only; Team/Workspaces/Settings remain reachable via More; switching to main dashboard restores full nav groups.

**Acceptance Scenarios**:

1. **Given** user is in Social shell, **When** they open Apps, **Then** they see Social Create / Inbox / Library / Insights items relevant to social publishing.
2. **Given** user is in Social shell, **When** they click Dashboard (social home), **Then** they stay in Social; a clear control exists to return to the main product dashboard.
3. **Given** user is on main dashboard shell, **When** they open Apps, **Then** existing NAV_GROUPS behavior is preserved (Create + Inbox including Leads/Mail/Chatbot, etc.).

---

### User Story 3 - Main dashboard room for more staff (Priority: P2)

As an owner/admin, the main `/dashboard` can highlight non-social (or cross-cutting) modules and entry points for staff who do not live in social day-to-day (e.g. Leads, Mail, Chatbot, Team), while social staff prefer `/social`.

**Why this priority**: User intent is that the main dashboard can grow for other staff once social has its own home.

**Independent Test**: Main dashboard shows a prominent “Social” entry card/link plus existing non-social modules; social deep links still work from main if desired.

**Acceptance Scenarios**:

1. **Given** `/dashboard`, **When** page loads, **Then** a clear CTA/card links to Social Dashboard.
2. **Given** `/dashboard`, **When** viewing module cards, **Then** social tools are either summarized under one Social entry or remain available without removing Leads/Mail/Chatbot cards.

---

### User Story 4 - Same tenancy & workspace (Priority: P2)

As a user, Social Dashboard uses the same tenant + active workspace as the rest of Mako; switching workspace updates social overview the same way PlatformDashboard does today.

**Why this priority**: Social is not a second tenant — it is a second product shell.

**Independent Test**: Switch workspace in header; social overview/content lists refresh for the new workspaceId.

**Acceptance Scenarios**:

1. **Given** workspace A with posts, **When** user switches to workspace B inside Social, **Then** social lists/overview reflect B only.
2. **Given** Social shell, **When** user opens Team or Workspaces from More, **Then** existing pages load (shared chrome/settings).

---

### Edge Cases

- Deep links to `/content`, `/scheduler`, `/replies`, etc. from bookmarks: either auto-enter Social shell when path is social-scoped, or keep current main shell — must be consistent (document decision in research).
- Permissions: partial social access (e.g. Viewer) still sees Social home with allowed items only.
- Mobile: Social shell stacks like current AppNavbar; touch targets remain usable.
- No duplicate OAuth or publish backends — Social reuses existing routes/APIs.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a dedicated Social Dashboard route distinct from `/dashboard`.
- **FR-002**: System MUST provide a Social product shell (layout + nav config) that scopes navigation to social media workflows.
- **FR-003**: System MUST preserve the existing main dashboard and full nav for non-social / general staff workflows.
- **FR-004**: System MUST offer navigation between Social shell and main dashboard without logging out.
- **FR-005**: Social shell MUST reuse existing social routes/pages (content, scheduler, publisher, replies, media, analytics as applicable) — no parallel page implementations in v1.
- **FR-006**: Access MUST continue to enforce tenant membership + RBAC permissions; no cross-tenant leakage.
- **FR-007**: Active workspace context MUST apply inside Social the same as elsewhere.
- **FR-008**: Main dashboard MUST expose an entry point into Social Dashboard so staff can discover it.
- **FR-009**: Presentation-first for v1: no new Nest/Rust API modules required unless research finds a missing overview endpoint (prefer composing existing APIs).

### Key Entities

- **Product shell**: Main vs Social (client routing + nav config + layout variant).
- **Social overview**: Aggregated cards/widgets (connections, queue, inbox) — client composition of existing data.
- **Nav groups**: Social-scoped vs full `NAV_GROUPS`.
- **Tenant / workspace / membership**: Unchanged; shared across shells.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Authenticated user can open Social Dashboard and main Dashboard as two distinct homes in under 3 clicks from either.
- **SC-002**: While in Social shell, ≥80% of primary nav destinations are social workflows (content/schedule/connect/inbox/media/analytics); Leads/Mail/Chatbot are not in the primary Social Apps list (reachable via main shell or explicit “All apps” if added).
- **SC-003**: Existing social routes remain functional with no API contract changes for MVP.
- **SC-004**: Smoke: switch workspace on Social home; content scoped correctly; no tenancy regressions on Team/Settings.

## Assumptions

- “More staff” means the main dashboard can emphasize non-social roles/workflows; not a new Staff entity in v1.
- Social = publishing + social inbox + connections + media/templates used for posts + social analytics; WhatsApp may stay shared or inbox-linked (research decides placement).
- DESIGN.md tokens apply; no full visual redesign of every social page in this feature.
- Optional later: social-specific roles/permissions — out of scope for MVP unless needed for FR-006.
