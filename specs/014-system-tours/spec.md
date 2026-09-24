# Feature Specification: System Wide Tours using Driver.js

**Feature Branch**: `[014-system-tours]`

**Created**: 2026-09-21

**Status**: Draft

**Input**: User description: "i need you to implement system wide tours use Driver.js"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - New User Onboarding Tour (Priority: P1)

As a new user logging into the platform for the first time, I want to be guided through a step-by-step tour of the main interface, so that I can quickly understand how to navigate and use the system.

**Why this priority**: Core value of the feature is onboarding new users.

**Independent Test**: Can be verified by logging in with a new user account and observing the tour start automatically.

**Acceptance Scenarios**:
1. **Given** a newly registered user logs in for the first time, **When** they reach the main dashboard, **Then** an introductory tour automatically starts, highlighting key navigation elements.

---

### User Story 2 - Feature Discovery Tours (Priority: P2)

As a user navigating to a complex page, I want to see a tour explaining the page's capabilities, so that I can utilize advanced features without confusion.

**Why this priority**: Enhances feature adoption and reduces support requests.

**Independent Test**: Can be verified by navigating to a specific feature page and triggering the contextual tour.

**Acceptance Scenarios**:
1. **Given** a user opens the Content Engine for the first time, **When** the page loads, **Then** a contextual tour explains the Publisher, Scheduler, and AI generation tools.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST integrate the `driver.js` library to render interactive, step-by-step product tours.
- **FR-002**: System MUST define distinct tour configurations (steps, highlighted elements, popover text) for key areas of the application, co-located with their respective components (e.g., `Component.tour.ts`) to ensure decentralized maintenance.
- **FR-003**: System MUST track which tours a user has completed to prevent showing the same auto-starting tour multiple times.
- **FR-004**: System MUST allow users to skip or dismiss a tour at any point, and record this dismissal.
- **FR-005**: System MUST provide a manual way to restart a tour (e.g., a "Help" or "Tour" button) for users who want to re-review a feature.
- **FR-006**: Tours MUST be responsive and function correctly across desktop and mobile views.
- **FR-007**: Main page tours MUST auto-start on first visit, whereas deep micro-tours (for modals, sheets, and filters) MUST NOT auto-start, but be triggered manually via a contextual "Help/Tour" button.
- **FR-008**: The tour engine MUST gracefully handle dynamic elements (e.g. data fetching, animations) by waiting or retrying for the target element before failing the step.

### Key Entities 

- **UserPreferences**: Needs to track completed/dismissed tour identifiers.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Tours successfully initialize and render on target elements without breaking existing UI layouts.
- **SC-002**: Users only see an auto-started tour exactly once per defined tour flow.
- **SC-003**: 100% of defined tour steps map correctly to existing DOM elements across major application pages.

## Assumptions

- Users have modern browsers that support standard rendering.
- Key UI elements have identifiable, stable CSS classes or IDs to attach tour steps to.

## Clarifications Resolved

- **Tour State Storage**: Tour completion state will be saved globally in the database (per user) to sync across devices.
- **Initial Scope**: The initial implementation will configure tours for the main Dashboard, the Content Engine, and the Brand Brain.

## Clarifications

### Session 2026-09-23
- Q: Trigger Strategy for Micro-tours: Auto-starting a tour on every single modal, sheet, or filter interaction will severely disrupt the user's workflow. How should these deep/micro-tours be triggered? → A: (Recommended) Auto-start only main page tours; use a contextual "Help/Tour" button to manually trigger tours for modals, sheets, and specific filters.
- Q: Tour Configuration Management: By adding tours to all sections, modals, and sheets, the number of tour steps will explode. How should we manage and store the configurations for these tours? → A: (Recommended) Decentralize step configurations: define each tour's steps within or next to the component it documents (e.g. `LeadAgent.tour.ts`), and pass them to the tour service when triggered.
- Q: Dynamic Element Readiness: Modals, sheets, and filters often rely on fetched data, meaning their DOM elements might not be immediately present when the tour starts. How should the tour handle dynamic elements? → A: (Recommended) Leverage `driver.js` hooks (e.g. `onHighlightStarted`) to wait/retry finding dynamic elements with a timeout, ensuring smooth transitions even if data is loading.

### Session 2026-09-22
- Q: Besides the Dashboard and Content Engine, which additional screens should have interactive tours? → A: Brand Brain (Guides users on how to define their brand voice and upload assets)
