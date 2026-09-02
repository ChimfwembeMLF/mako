# Research: Mobile UI Parity & Missing Components

**Feature**: `007-mobile-ui-parity` | **Date**: 2026-08-27

## R1 — Navigation IA: tabs vs More menu

**Decision**: Keep six bottom tabs (Home, Content, Connect, Inbox, Schedule, Profile) and add a seventh **More** tab exposing permission-filtered destinations from web `SOCIAL_NAV_GROUPS` + subset of `MORE_ITEMS`.

**Rationale**: Matches spec assumption (bottom tabs primary); avoids 20-tab bar; aligns with web “Apps” dropdown pattern where infrequent routes are grouped.

**Alternatives considered**:
- *Hamburger-only drawer*: Hides core social routes; hurts discoverability.
- *Duplicate all web routes as tabs*: Unusable on phone form factor.

**Mobile nav mapping** (initial):

| Destination | Mobile route | Permission (web) |
|-------------|--------------|------------------|
| Brand Brain | `/more/brand-brain` | `settings.brand_brain` |
| Media | `/more/media` | (default authenticated) |
| Templates | `/more/templates` | (default) |
| Campaigns | `/more/campaigns` | content-related |
| Analytics | `/more/analytics` | (default) |
| Settings | `/more/settings` | `settings.view` |
| Team | `/more/team` | `team.view` |
| Approvals | `/more/approvals` | `approvals.view` |
| Leads | `/more/leads` | leads permissions |
| Mail | `/more/mail` | mail access |
| WhatsApp hub | `/more/whatsapp` | (default) |
| Auto-reply rules | `/more/auto-reply-rules` | inbox/replies related |

Chatbot, Ads, Reports, Export, Backoffice: **out of scope** (FR-016).

---

## R2 — Design system: complete primitive set

**Decision**: Extend existing `mobile/src/components/ui/` with:

| Component | Purpose |
|-----------|---------|
| `Toast` + `ToastProvider` | Non-blocking success/error (replaces Alert-only feedback) |
| `EmptyState` | Icon/title/body/CTA for list screens |
| `Skeleton` | List/card loading placeholders |
| `Sheet` | Modal bottom sheet (OAuth finalize, media pick, template pick) |
| `SegmentedControl` | Calendar/List toggle (alternative to Chip row) |
| `LockedNavItem` | More menu row when permission denied |

**Rationale**: Spec FR-001/FR-004; web uses shadcn toast/sheet/dialog — RN equivalents keep parity without porting shadcn.

**Alternatives considered**:
- *react-native-paper full theme*: Heavier dependency; conflicts with custom Wise tokens.
- *Copy-paste StyleSheets per screen*: Already caused inconsistency before 007 work began.

**Typography**: `@expo-google-fonts/inter` + `manrope` loaded in root layout (started); fallback to system if load fails.

**Dark mode**: `ThemeContext` with light/dark token maps mirroring `client/src/index.css` `.dark` vars; respect tenant theme when API exposes it (Settings fetch).

---

## R3 — App shell & workspace switcher

**Decision**: Add `AppShellHeader` on tab stacks showing active workspace name + tap → bottom sheet list of workspaces (reuse `api.getWorkspaces`). Home tab becomes social dashboard; workspace selection not sole purpose of Home.

**Rationale**: FR-003; web navbar includes workspace context.

**Alternatives considered**:
- *Keep Home as workspace picker only*: Violates FR-003; extra tap for daily work.

---

## R4 — API client extension strategy

**Decision**: Port method groups from `client/src/lib/api.ts` into `mobile/src/lib/api.ts` incrementally per phase:

| Phase | API groups |
|-------|------------|
| P2 | `brandProfiles`, `media` (list + pick), `templates` (list + get), `contentCampaigns`, `analytics.platformDashboard` |
| P3 | `tenantMembers`/team, `approvalRequests`, `leads`, `mail.gmail` inbox summary, `whatsapp` status, `autoReplyRules`, `auth.forgotPassword` |

**Rationale**: Web client already defines request shapes; Rust migration doc shows modules exist for brand, media, templates, campaigns, analytics (partial), approvals, whatsapp, leads (partial), mail.

**Alternatives considered**:
- *OpenAPI codegen*: No unified OpenAPI artifact today; higher setup cost.
- *GraphQL*: Not used by Mako.

**Rust gap protocol**: If mobile calls return 404 on production Rust, either (a) implement minimal Rust handler mirroring Nest or (b) document temporary Nest-only dev path in quickstart — not silent failure.

---

## R5 — Core workflow polish (in progress baseline)

**Decision**: Treat the following as **partially complete** entering implement; tasks should verify/finish rather than rewrite:

- Calendar + list scheduler (`ScheduleCalendar`, stats row)
- Inbox `MessageBubble` threads
- Platform-branded Connections cards
- Shared UI on auth + core tabs
- Inter/Manrope fonts

Remaining P1 core: toast integration on save/publish/reply/connect; permission gates on all actions; media library pick in editor (P2 but affects workflow).

---

## R6 — Auth & onboarding

**Decision**:
- Forgot password: `POST /api/v1/auth/forgot-password` with same opaque success copy as web.
- Onboarding: one-time dismissible banner on Home after first sign-in (`AsyncStorage` key `mako_onboarding_dismissed`).

**Rationale**: FR-010/FR-011; low risk, no new backend.

---

## R7 — Tablet / split inbox (optional P2)

**Decision**: Defer split list/detail inbox to optional task; phone layout remains stack navigation. If `useWindowDimensions().width >= 768`, render master-detail.

**Rationale**: Spec edge case “optional enhancement”; not blocking SC-002.

---

## R8 — Testing & acceptance

**Decision**: Device quickstart with sections: Shell audit (SC-001), Core workflow (SC-002), More destinations (SC-003), Empty states (SC-004), Auth (SC-005), Dark theme (SC-006), Recorded log (SC-007).

**Alternatives considered**:
- *Detox E2E*: Not in repo today; manual QA matches 005/006 pattern.

---

## Resolved unknowns

All Technical Context items resolved — no NEEDS CLARIFICATION remain for planning.

---

## R9 — Expo web dev CORS (8081)

**Decision**: NestJS `buildNestCorsOptions()` in `api/src/common/cors.util.ts` includes `http://localhost:8081` and `http://127.0.0.1:8081` by default via `EXPO_DEV_PORT` (default `8081`).

**Rationale**: Mobile Expo web dev (`yarn web` / Metro on 8081) must call API on `:4000` without CORS blocks during local parity QA.

**Verified**: 2026-08-31 — defaults list includes Expo port alongside Vite (`5173`) and API port.
