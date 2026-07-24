# Quickstart: Validate client DESIGN.md redesign

## Prerequisites

- Branch `002-client-design-redesign` with token + shell work applied
- Node/Yarn as used by the monorepo
- Browser desktop (≥1024) and mobile (&lt;768) widths

## Setup

```bash
cd /Users/thecodefather/Documents/personal/projects/mako
yarn workspace client dev
# or: cd client && yarn dev
```

Open the printed local URL (typically `http://localhost:5173`).

## Validation scenarios

### 1. Tokens (US1)

1. Open DevTools → inspect `:root` on any page
2. Confirm `--primary` is Wise green (≈ `#9fe870`), not Rausch `#ff385c`
3. Confirm soft canvas / ink-related variables match [contracts/ui-design-system.md](./contracts/ui-design-system.md)
4. Grep check (from repo root):

```bash
rg -n "#ff385c|rausch|349 100% 61%" client/src/index.css client/src/lib/design-tokens.ts client/src/lib/mako-brand.ts client/vite.config.ts
```

Expected: **no** default-brand hits (OAuth provider files exempt if any).

### 2. Landing (US2)

1. Log out (or private window)
2. Visit `/`
3. Expected: sage/soft hero or dark polarity band; heavy display headline; lime primary CTA; ~24px rounded cards; brand readable without relying on nav alone
4. Resize to &lt;768px: stacked layout, usable CTAs

### 3. Auth (US2)

1. Visit `/auth`
2. Expected: soft auth card, ink-border inputs, lime submit CTA; OAuth buttons may keep provider colors

### 4. App shell (US3)

1. Sign in → `/dashboard`
2. Expected: sidebar active state uses lime; primary buttons lime; cards/controls use new radius/tokens
3. Smoke navigate: `/content`, `/scheduler`, `/billing`, `/settings`, `/publisher` — pages load; no blank shell

### 5. Regression sanity

- Auth login/logout still works
- No API 4xx/5xx introduced by UI-only changes
- PWA theme_color is not `#ff385c`

## References

- [DESIGN.md](../../DESIGN.md)
- [data-model.md](./data-model.md)
- [contracts/ui-design-system.md](./contracts/ui-design-system.md)
- [research.md](./research.md)
