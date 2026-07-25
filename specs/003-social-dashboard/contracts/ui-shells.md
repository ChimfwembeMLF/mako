# Contract: Social vs Main product shells

## Routes

| Path | Shell | Purpose |
|------|-------|---------|
| `/dashboard` | main | General staff home |
| `/social` | social | Social media home |
| `/content`, `/scheduler`, `/publisher`, `/replies`, `/media`, `/templates`, `/campaigns`, `/brand-brain`, `/analytics` | social* | Existing pages; chrome = social when path ∈ social set |
| `/leads`, `/mail`, `/chatbot/*`, `/ads`, `/team`, … | main* | Non-social; chrome = main |

\*Exact path list lives in `client/src/lib/nav-config.ts` (or `social-shell.ts`) as `SOCIAL_PATH_PREFIXES`.

## Nav contracts

### Main shell

- Top: Dashboard → `/dashboard`
- Apps: existing `NAV_GROUPS` (Create, Inbox, Insights, Library, Grow)
- More: existing `MORE_ITEMS`
- Must include entry to Social (nav link and/or dashboard card)

### Social shell

- Top: Social home → `/social`
- Control: “Main app” / “All products” → `/dashboard`
- Apps: `SOCIAL_NAV_GROUPS` only (see research R2)
- More: Team, Workspaces, Approvals, Billing, Settings (shared) — no need to hide admin tools from eligible users

## Layout

- Same `DashboardLayout` component; shell mode prop or context.
- DESIGN.md tokens; no second design system.

## Auth / tenancy

- `ProtectedRoute` unchanged.
- Permissions gate `/social` entry (any social-relevant permission).
- Workspace switcher behavior unchanged.

## Non-goals

- New OAuth callbacks
- New publish APIs
- Duplicate page components under `/social/...` for MVP
