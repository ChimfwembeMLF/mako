# Feature Specification: Client UI redesign from DESIGN.md

**Feature Branch**: `002-client-design-redesign`

**Created**: 2026-07-24

**Status**: Draft

**Input**: User description: Redesign the React client UI using DESIGN.md (Wise-inspired design language: lime primary, sage canvas, heavy display type, 24px rounded cards/buttons) while preserving Mako product workflows.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Design token foundation (Priority: P1)

As a Mako user, the app’s colors, radii, spacing, and fonts match DESIGN.md so every screen inherits the new brand without rewriting every page first.

**Why this priority**: Tokens unblock all surfaces; shipping page restyles without token migration leaves Airbnb Rausch (`#ff385c`) as the system primary.

**Independent Test**: Load `/auth` and `/` (landing) and any dashboard page; CSS variables / Tailwind `primary`, canvas soft, ink, and `rounded-xl` (24px) match DESIGN.md hex values; no remaining default Rausch primary on CTAs using `bg-primary`.

**Acceptance Scenarios**:

1. **Given** a fresh client build, **When** inspecting `:root` CSS variables, **Then** `--primary` resolves to Wise green `#9fe870` (or equivalent HSL), `--primary-foreground` / on-primary is near-black `#0e0f0c`, and soft canvas / ink tokens match DESIGN.md.
2. **Given** shadcn/Tailwind components using `bg-primary` / `text-primary`, **When** rendered, **Then** they use the new brand green CTA, not Airbnb Rausch.
3. **Given** DESIGN.md typography guidance, **When** fonts load, **Then** body/UI use Inter; display/hero use a heavy geometric substitute for Wise Sans (e.g. Manrope/Geist/Inter 900) documented in research — proprietary Wise Sans is not required.

---

### User Story 2 - Marketing & auth shells (Priority: P2)

As a visitor or signing-in user, landing and auth feel like the DESIGN.md brand: sage hero bands, heavy display headlines, lime CTA pills, white cards on soft canvas.

**Why this priority**: Public surfaces are the brand test; constitution prioritizes DESIGN.md for marketing/branded surfaces.

**Independent Test**: Open `/` (logged out) and `/auth` on desktop and mobile; first viewport shows brand-forward composition (not a dense dashboard); primary CTA is lime on neutral; cards use ~24px radius.

**Acceptance Scenarios**:

1. **Given** an unauthenticated user on `/` or `/home`, **When** the landing loads, **Then** hero uses sage/soft canvas (or dark polarity band per DESIGN.md), display-weight headlines, and a lime primary CTA — without Airbnb red as the brand accent.
2. **Given** `/auth`, **When** the sign-in/up card renders, **Then** it follows `ex-auth-form-card` / text-input chrome (soft card, ink borders, xl radius) while OAuth provider buttons may keep provider brand colors.
3. **Given** mobile width &lt; 768px, **When** viewing landing/auth, **Then** layout stacks, CTAs remain ≥ ~48px touch height, and brand hierarchy remains readable.

---

### User Story 3 - Product app shell restyle (Priority: P3)

As a signed-in tenant user, the dashboard shell (sidebar/nav, page chrome, primary buttons, cards) uses the new tokens so the product feels consistent with marketing without rewriting every feature page in v1.

**Why this priority**: High leverage via shell + primitives; full page-by-page redesign is out of scope for MVP.

**Independent Test**: Sign in, open `/dashboard`; sidebar active indicator uses primary green; page background / cards follow soft canvas + white card contrast; primary actions use lime CTAs.

**Acceptance Scenarios**:

1. **Given** `DashboardLayout`, **When** a nav item is active, **Then** the active indicator uses `{colors.primary}` (lime), not Rausch.
2. **Given** shared UI primitives (`Button` primary/secondary/outline, Card), **When** used in product pages, **Then** they match DESIGN.md button/card recipes (24px radius, sage secondary, ink outline tertiary).
3. **Given** existing feature routes (content, scheduler, billing, etc.), **When** opened after the shell restyle, **Then** workflows and routes remain unchanged (no functional regressions); residual hard-coded Airbnb colors may remain only where explicitly scoped for a later pass.

---

### Edge Cases

- Dark mode: either map a coherent dark palette from DESIGN.md semantic colors or document “light-first; dark deferred” — must not leave broken contrast.
- Provider OAuth buttons keep provider brand colors (Meta blue, etc.) — do not force lime.
- Success/status greens must use semantic `{colors.positive*}`, not CTA primary lime (DESIGN.md Do’s).
- PWA `theme_color` / manifest must update away from `#ff385c`.
- Legal pages (`/privacy`, `/terms`, `/data-deletion`) should inherit tokens at minimum; full marketing restyle optional in this feature.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST replace Airbnb-inspired token sources (`client/src/index.css`, `client/src/lib/design-tokens.ts`, `client/src/lib/mako-brand.ts`, Tailwind theme extensions) with DESIGN.md Wise-inspired tokens.
- **FR-002**: System MUST map DESIGN.md colors to CSS custom properties consumed by existing `hsl(var(--*))` Tailwind/shadcn patterns (or an equivalent documented migration).
- **FR-003**: System MUST set canonical radius so cards/buttons default to `{rounded.xl}` 24px where DESIGN.md requires it (inputs may use `{rounded.md}` 12px).
- **FR-004**: System MUST load Inter for UI/body and a documented Wise Sans substitute for display/hero (weight 900 on marketing heroes).
- **FR-005**: Landing (`LandingPage`) and Auth (`Auth`) MUST be redesigned to DESIGN.md hero/nav/auth-card patterns (client-only; no API changes).
- **FR-006**: `DashboardLayout` and shared UI primitives (Button, Card, Input as applicable) MUST adopt new tokens/active states.
- **FR-007**: System MUST NOT change API contracts, auth flows, or tenant isolation; this feature is presentation-only in `client/`.
- **FR-008**: System MUST update PWA/manifest theme colors and any brand hex constants away from Airbnb Rausch for default Mako branding.
- **FR-009**: Redesign MUST remain usable on mobile and desktop breakpoints defined in DESIGN.md (&lt;768 / 768–1023 / ≥1024).

### Key Entities

- **Design tokens**: Colors, typography, spacing, radius, component recipes from `DESIGN.md`.
- **Surface shells**: Landing, Auth, DashboardLayout.
- **UI primitives**: Button, Card, Input, Badge (shadcn under `client/src/components/ui/`).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero default brand references to `#ff385c` / Rausch as primary CTA in token files and PWA theme_color after migration (provider brand colors excluded).
- **SC-002**: Spot-check of landing, auth, and dashboard shows lime primary CTA and sage/white surface contrast matching DESIGN.md.
- **SC-003**: Existing authenticated routes remain reachable; smoke navigate ≥5 core pages without layout breakage.
- **SC-004**: Lighthouse/manual contrast: primary text on sage/white/ink backgrounds remains readable (WCAG AA for body text).

## Assumptions

- `DESIGN.md` at repo root is the source of truth (Wise-inspired); prior Airbnb comments in code are obsolete.
- Proprietary Wise Sans will not be licensed for v1; open substitutes (Manrope/Geist/Inter 900) are acceptable if documented.
- Full restyle of every feature page is out of scope; token + shell + primitives first.
- No Nest/Rust API work; no schema migrations.
- Dark mode may be light-first with deferred dark token pass if research chooses simplicity.
