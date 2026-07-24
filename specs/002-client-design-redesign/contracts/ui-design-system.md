# Contract: DESIGN.md → Client visual system

## Source of truth

| Artifact | Role |
|----------|------|
| `DESIGN.md` | Brand tokens, component recipes, do’s/don’ts |
| `client/src/index.css` | Runtime CSS variables (`:root`) |
| `client/src/lib/design-tokens.ts` | TS mirror for non-CSS consumers |
| `client/src/lib/mako-brand.ts` | Named brand hex/HSL helpers |
| `client/tailwind.config.ts` | Tailwind ↔ CSS var bridge |

See `research.md` §R3b for hex→CSS variable mapping used in implementation.

## Color contract (defaults)

| Semantic role | DESIGN.md | Must apply to |
|---------------|-----------|---------------|
| Primary CTA | `#9fe870` | `--primary`, `bg-primary`, primary Button |
| On primary | `#0e0f0c` | `--primary-foreground` |
| Soft canvas | `#e8ebe6` | Page/hero soft surfaces |
| Card canvas | `#ffffff` | Cards / popovers (light) |
| Ink | `#0e0f0c` | Headings, default foreground |
| Body / mute | `#454745` / `#868685` | Secondary / caption |
| Destructive | negative family | Destructive buttons / errors |
| Success | positive family | Status only — **not** CTA |

**Forbidden as default Mako brand primary:** `#ff385c` (Airbnb Rausch).

**Exempt:** Third-party OAuth button colors (Google/Meta/LinkedIn/X/etc.).

## Shape contract

| Element | Radius |
|---------|--------|
| Primary/secondary/tertiary buttons | 24px (`rounded.xl`) |
| Content / feature cards | 24px |
| Text inputs | 12px (`rounded.md`) |
| Status badges | pill |

## Typography contract

| Role | Face | Weight |
|------|------|--------|
| Marketing hero display | Wise Sans substitute (Manrope/Inter) | 900 |
| Sub-display / section | Inter | 600 |
| Body / UI / buttons | Inter | 400–600 |

## Shell contracts

### Landing (logged-out `/`)

- First viewport: brand-forward (Mako name + one headline + short support + CTA group + dominant visual/band).
- Soft sage (or dark polarity) hero; lime CTA on neutral — never lime-on-lime.
- Sticky/top nav per `nav-bar` / `nav-link`.

### Auth (`/auth`)

- Auth card matches soft-card chrome; inputs ink-bordered; primary submit = lime pill.
- Provider buttons may keep provider colors.

### App shell (`DashboardLayout`)

- Active nav indicator = primary lime.
- Shell backgrounds use soft canvas / white card contrast where applicable.
- No route or permission model changes.

## Non-goals

- API / webhook / cron changes
- Licensing proprietary Wise Sans
- Full restyle of every feature page in v1
