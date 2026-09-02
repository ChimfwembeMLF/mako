# Feature Specification: Mobile UI Parity & Missing Components

**Feature Branch**: `007-mobile-ui-parity`

**Created**: 2026-08-27

**Status**: Draft

**Input**: User description: "i need you add all the missing components"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Web-consistent mobile shell and design system (Priority: P1)

A signed-in marketer opens the mobile app and immediately recognizes the same Mako look, navigation patterns, and primary actions as the web social workspace: sage canvas, lime CTAs, Manrope/Inter typography, white cards, page headers with icon tiles, and consistent buttons, inputs, badges, and empty/loading states across every screen.

**Why this priority**: Without a shared visual and interaction language, every new screen feels bolted-on and users cannot trust that mobile actions match web.

**Independent Test**: Walk through Home, Content, Scheduler, Connections, Inbox, and Profile on a device; confirm the same color tokens, typography, button variants, and page-header pattern appear on each screen, and that primary actions (Create post, Sync inbox, Connect) are visually identical in weight and placement logic to web.

**Acceptance Scenarios**:

1. **Given** a signed-in user on any core tab, **When** they view page titles and primary actions, **Then** headers use the web-style icon tile + title + subtitle pattern and primary CTAs use the lime filled style.
2. **Given** a list screen with no data, **When** the user opens it, **Then** they see a purposeful empty state (not a blank screen) with guidance toward the next action.
3. **Given** a transient success or failure (save, publish, reply, connect), **When** the action completes, **Then** feedback appears as an in-app toast/banner—not only a blocking system alert.
4. **Given** the user switches workspace, **When** they do so from the app shell, **Then** they do not need to visit a dedicated workspace-only home screen to change context.

---

### User Story 2 - Complete core social workflows on mobile (Priority: P1)

A marketer completes the same daily social jobs on mobile that they already do on web for the social shell: browse and edit drafts with existing media visible, use calendar + list scheduling views, connect/disconnect networks with platform-branded cards, read and reply in inbox threads (DMs and comments) with clear inbound/outbound bubbles, and publish or schedule with permission-aware actions.

**Why this priority**: These are the highest-frequency workflows; partial UI without functional parity blocks adoption.

**Independent Test**: On a workspace with connected accounts and mixed inbox types, create a draft, attach media, schedule it, view it on the calendar, open inbox threads, reply, and publish another post—all without switching to web.

**Acceptance Scenarios**:

1. **Given** scheduled posts exist, **When** the user opens Scheduler, **Then** they can toggle calendar and list views, see due-today/overdue indicators, and open a post from a calendar day.
2. **Given** a draft with attached media, **When** the user reopens it on mobile, **Then** existing media is visible alongside newly picked images.
3. **Given** DMs and comment threads, **When** the user opens a conversation, **Then** messages appear in distinct inbound/outbound (or selectable comment) bubbles with timestamps, and replies show truthful success or failure.
4. **Given** a user without publish permission, **When** they view the editor, **Then** publish and restricted edit actions are disabled or hidden consistently with their role.

---

### User Story 3 - Missing social product surfaces from web navigation (Priority: P2)

A marketer accesses additional social product areas on mobile that already exist on web and share the same backend capabilities: Brand Brain essentials, media library picking, post templates, campaigns list, analytics snapshot, and account/settings—not the full marketing-suite megas.

**Why this priority**: Users expect parity with web navigation labels; missing entries force them back to desktop for routine tasks.

**Independent Test**: From mobile navigation, open each added surface (Brand Brain, Media, Templates, Campaigns, Analytics, Settings) and perform one read or lightweight edit action supported on web for the same workspace.

**Acceptance Scenarios**:

1. **Given** Brand Brain data exists for the workspace, **When** the user opens Brand Brain on mobile, **Then** they can view core brand fields and save permitted edits.
2. **Given** assets exist in the media library, **When** the user attaches media while drafting, **Then** they can choose from library items—not only the device camera roll.
3. **Given** system or tenant templates exist, **When** the user starts a new post, **Then** they can apply a template to pre-fill content.
4. **Given** campaigns exist for the workspace, **When** the user opens Campaigns, **Then** they see the list with status and can open campaign-linked content read-only or as permitted.
5. **Given** analytics data is available, **When** the user opens Analytics, **Then** they see a high-level performance snapshot for the active workspace (not an empty placeholder).
6. **Given** a signed-in user, **When** they open Settings, **Then** they can view account/preferences surfaces already available on web for non-admin users.

---

### User Story 4 - Engagement, team, and governance entry points (Priority: P3)

A team lead or operator can view engagement and governance items on mobile where web already exposes them: team roster, approvals queue, leads list, mail inbox summary, WhatsApp hub status, and auto-reply rules overview—scoped by permissions.

**Why this priority**: Extends parity to secondary but important ops workflows without requiring full web feature depth on day one.

**Independent Test**: With appropriate role permissions, open Team, Approvals, Leads, Mail, WhatsApp, and Inbox Rules from mobile and confirm read/list behavior matches web access for the same user.

**Acceptance Scenarios**:

1. **Given** a user with team view permission, **When** they open Team, **Then** they see members and roles for the tenant.
2. **Given** pending approvals exist, **When** a user with approvals permission opens Approvals, **Then** they see items awaiting action and can approve/reject if web allows the same action.
3. **Given** inbound leads exist, **When** the user opens Leads, **Then** they see qualified/unqualified entries and can open a lead detail.
4. **Given** a connected mail account, **When** the user opens Mail, **Then** they see inbox summary threads and can read messages (reply optional in v1 of this story).
5. **Given** WhatsApp is connected, **When** the user opens WhatsApp, **Then** they see connection health and entry points to conversations/templates already unified elsewhere.
6. **Given** auto-reply rules exist, **When** the user opens inbox rules, **Then** they can view (and toggle if permitted) rules matching web.

---

### User Story 5 - Auth, onboarding, and accessibility polish (Priority: P3)

A new or returning user can recover access and orient quickly: forgot-password flow, sign-up/sign-in matching web auth screens, optional first-run onboarding hints, and readable typography on small screens—including dark-mode support if the tenant theme uses it on web.

**Why this priority**: Reduces drop-off and support burden; polish that makes the component set feel finished.

**Independent Test**: Complete forgot-password request flow, sign in on fresh install, and verify onboarding hint appears once; toggle dark mode if enabled for tenant and confirm legibility.

**Acceptance Scenarios**:

1. **Given** a user forgot their password, **When** they request a reset from mobile, **Then** they receive the same outcome messaging as web (without exposing whether an email exists).
2. **Given** a first-time signed-in user, **When** they land in the app, **Then** they see a concise onboarding hint pointing to connect accounts and create first post (dismissible).
3. **Given** dark theme is active for the user/tenant, **When** they navigate core screens, **Then** text and controls remain legible and brand tokens invert consistently with web.

---

### Edge Cases

- User lacks permission for a nav item: hide or show locked state with explanation—not a crash or empty route.
- Workspace has no Brand Brain yet: show setup prompt consistent with web, not a broken screen.
- Large media library or long campaign lists: paginate or lazy-load; show loading skeletons, not spinners only.
- Offline or timeout while opening a new surface: show offline banner and retry, preserving prior tab state.
- Tablet width: inbox may use split list/detail layout when space allows (optional enhancement within P2 inbox polish).
- Super-admin backoffice, job queues, and platform system settings remain out of scope unless explicitly added later.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a shared mobile design system covering buttons, inputs, cards, badges, chips, page headers, hero banners, empty states, loading states, toasts/banners, and message bubbles used consistently across all mobile screens.
- **FR-002**: System MUST apply the Wise-inspired Mako tokens (sage canvas, lime primary, ink text, 24px radius, Manrope display + Inter body) on iOS, Android, and mobile web dev builds.
- **FR-003**: System MUST expose workspace switching from the app shell without requiring a dedicated workspace-only landing screen as the sole switcher.
- **FR-004**: System MUST provide a “More” or equivalent navigation entry listing web social-shell destinations not on the bottom tab bar, permission-filtered.
- **FR-005**: System MUST implement calendar + list scheduler views with due-today and overdue indicators for scheduled content.
- **FR-006**: System MUST render inbox threads with visually distinct inbound/outbound messages and selectable comment threads with truthful reply outcomes.
- **FR-007**: System MUST surface Connections with platform-branded cards and connect/disconnect actions matching web-supported networks for the workspace.
- **FR-008**: System MUST add mobile entry points and read/edit flows for Brand Brain essentials, Media library, Post Templates, Campaigns list, Analytics snapshot, and Settings/account—where the live API already supports web.
- **FR-009**: System MUST add permission-gated mobile entry points for Team, Approvals, Leads, Mail inbox summary, WhatsApp hub status, and auto-reply rules overview—read-first, with actions only where web already permits them.
- **FR-010**: System MUST provide forgot-password on mobile auth screens aligned with web behavior.
- **FR-011**: System MUST show dismissible first-run onboarding hints for connect + first post after initial sign-in.
- **FR-012**: System MUST support dark theme legibility when tenant/user theme is dark, consistent with web theme behavior.
- **FR-013**: System MUST enforce tenant and workspace isolation and RBAC for every new surface and action.
- **FR-014**: System MUST use live production API behavior (Rust runtime) for all new data surfaces unless explicitly marked Nest-only in migration docs.
- **FR-015**: System MUST NOT require new backend product domains beyond what the live API already exposes for web parity items in FR-008 and FR-009.
- **FR-016**: Deferred for this feature’s acceptance: full Ads campaign builder, deep chatbot/knowledge authoring, billing checkout flows, super-admin backoffice, export jobs, push notifications, and drag-and-drop calendar reschedule.

### Key Entities

- **Design Token Set**: Colors, typography, spacing, and radius values shared with web branding.
- **UI Component**: Reusable visual/interaction primitive (button, card, toast, etc.).
- **Navigation Destination**: A routable product area mapped from web nav-config groups.
- **Workspace Context**: Active tenant + workspace selection driving all lists and edits.
- **Permission Gate**: Role capability determining visibility and mutability of destinations.
- **Content Asset**: Media library item attachable to drafts.
- **Template**: Reusable post copy source for new content.
- **Campaign**: Grouped content series with status.
- **Analytics Snapshot**: Aggregated performance metrics for a workspace/time window.
- **Approval Item**: Content or action awaiting reviewer decision.
- **Lead**: Inbound prospect record with qualification state.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a UI audit of six core tabs (Home, Content, Scheduler, Connections, Inbox, Profile), 100% use the shared page-header pattern and primary button styling.
- **SC-002**: 90% of testers completing a scripted social workflow (draft → schedule → calendar verify → inbox reply) finish without switching to web.
- **SC-003**: At least eight web social-shell destinations beyond the original six tabs are reachable on mobile with permission-correct visibility.
- **SC-004**: Empty and error states on new screens provide a next-step action in 100% of audited routes (no blank screens).
- **SC-005**: Forgot-password and sign-in flows match web success/error messaging in 100% of tested cases.
- **SC-006**: Dark-theme legibility check passes on all core tabs (contrast sufficient for body text and primary buttons).
- **SC-007**: Documented device quickstart for this feature records pass/fail for each new destination and core workflow before feature acceptance.

## Assumptions

- Builds on converged `005-mobile-core-features` and `006-mobile-core-hardening`; this feature adds UI/component parity and missing product surfaces rather than re-architecting auth or API clients.
- “Missing components” means both reusable UI primitives and missing product screens/routes that web already offers, prioritized P1 shell/core → P2 social surfaces → P3 engagement/admin entry points.
- Read-only or lightweight edit is acceptable for v1 of Analytics, Campaigns, and Mail where web has richer desktop layouts.
- Bottom tabs remain the primary mobile IA; infrequent destinations live under More/drawer/stack navigation.
- Server remains authoritative for permissions; mobile gates are best-effort and fail closed when permission state is unknown.
- No new secrets or OAuth providers are introduced in this spec; existing connect flows reuse web-supported networks.
- Super-admin platform tools, ads builder, and full chatbot authoring remain future slices unless backend gaps are discovered during planning.
