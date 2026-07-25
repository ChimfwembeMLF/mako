# Research: Social Media Dashboard

**Feature**: `003-social-dashboard` | **Date**: 2026-07-24

## R1 — Shell architecture

**Decision**: Introduce a **route-prefix shell** under `/social/*` that reuses `DashboardLayout` / `AppNavbar` with a `shell="social" | "main"` (or derive from `useLocation().pathname.startsWith('/social')`). Social home at `/social` or `/social/dashboard`. Existing pages keep their URLs (`/content`, `/scheduler`, …) but when opened from Social, either (A) nest under `/social/content` aliases, or (B) keep flat URLs and set shell mode via session/path heuristics.

**Chosen for MVP**: **(B) shell mode + flat URLs** for social destinations when navigated from Social nav; detect social paths via a shared `SOCIAL_PATH_PREFIXES` list so `/content` uses Social nav chrome. Main dashboard and non-social paths use main nav.

**Rationale**: Avoid rewriting every `<Link>` and route registration; fastest path to two homes. Document that bookmarks to `/content` show Social chrome (acceptable — content is social).

**Alternatives considered**:
- Nested routes only (`/social/content`) — cleaner isolation, more churn
- Separate React app — rejected (constitution / monorepo simplicity)

## R2 — What counts as “social”

**Decision**: Social shell primary nav includes: Brand Brain, Content Engine, Campaigns, Scheduler, Connections (`/publisher`), Social Inbox (`/replies`), Media, Post Templates, Analytics (and Reports if lightweight). **Exclude from primary Social Apps**: Leads, Email/Mail, Chatbot*, Knowledge, Chat History. WhatsApp: keep under Social Inbox adjacency **or** leave in main only — **MVP: link WhatsApp from Social Inbox area as optional item** (operators often treat WA as messaging). Ads: exclude from Social primary (Grow stays on main) unless product later merges paid+organic.

\*Chatbot remains main-shell for “more staff” on main dashboard.

## R3 — Main dashboard “more staff”

**Decision**: Keep existing module cards; add a prominent **Social** card/CTA to `/social`. Optionally collapse duplicate social cards into that single entry later (not required for MVP).

**Rationale**: Matches user goal without deleting capabilities from main.

## R4 — APIs

**Decision**: No new Nest/Rust endpoints for MVP. Social home composes existing client APIs (scheduler list, social accounts, replies unread if available, `PlatformDashboard` widgets).

**Alternatives**: Aggregated `/api/v1/social/overview` — defer until composition is slow or duplicated.

## R5 — Permissions

**Decision**: Entering `/social` requires any of: content view/create, replies view, analytics view, or publisher/connect equivalent (map to existing `P.*` keys). Empty-permission users redirect to `/dashboard` or 403 pattern already used.

**Rationale**: No new RBAC tables; reuse `usePermissions`.

## R6 — Deep links & shell switching

**Decision**:
- Paths in `SOCIAL_PATHS` → Social chrome
- All other authenticated product paths → Main chrome
- Explicit “Main dashboard” / “Social” switches in navbar
- `/dashboard` always main; `/social` always social home

## Open items resolved

| Topic | Resolution |
|-------|------------|
| New Staff entity? | No — main dashboard UX only |
| Nest–Rust work? | None for MVP |
| DESIGN.md | Use existing tokens/shell patterns |
| WhatsApp | Optional Social nav item; not blocked |
