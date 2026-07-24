# Research: 002-client-design-redesign

## R1 — Current vs target brand

**Decision**: Treat repo-root `DESIGN.md` (Wise-inspired) as the single source of truth; retire Airbnb Rausch as default Mako primary.

**Rationale**: `client/src/index.css` and `client/src/lib/design-tokens.ts` still encode Airbnb (`--primary: 349 100% 61%` ≈ `#ff385c`). `DESIGN.md` now specifies `#9fe870` lime, sage canvas `#e8ebe6`, ink `#0e0f0c`, 24px radii. Constitution explicitly points frontend work at `DESIGN.md`.

**Alternatives considered**: Keep Rausch for app shell only — rejected; dual brand confuses Mako. Full page rewrite before tokens — rejected; high churn, low leverage.

## R2 — Token delivery mechanism

**Decision**: Keep shadcn’s `hsl(var(--token))` pattern; convert DESIGN.md hex → HSL components in `:root`; update `design-tokens.ts` / `mako-brand.ts` / Tailwind extensions to match.

**Rationale**: Hundreds of classes already use `bg-primary`, `text-muted-foreground`, etc. Rewriting to raw hex utilities would be a large break. HSL CSS variables remain the cheapest migration.

**Alternatives considered**: CSS Modules / styled-system package — rejected (YAGNI). Tailwind v4 CSS-first rewrite — out of scope.

Approximate HSL mappings (implementation may refine):

| Token | Hex | Role |
|-------|-----|------|
| primary | `#9fe870` | CTA |
| on-primary | `#0e0f0c` | Text on CTA |
| canvas-soft | `#e8ebe6` | Page / hero band |
| canvas | `#ffffff` | Cards |
| ink | `#0e0f0c` | Headings / default text |
| body | `#454745` | Secondary text |
| mute | `#868685` | Captions |
| positive / warning / negative | per DESIGN.md | Status only |

## R3 — Typography / Wise Sans substitute

**Decision**: Body/UI = **Inter** (400–700). Display/hero = **Manrope** (600–800) loaded via Google Fonts in `client/src/index.css`. Do not ship unlicensed Wise Sans.

**Rationale**: DESIGN.md allows Inter/Manrope/Geist substitutes. Manrope at 800 preserves geometric heaviness without licensing risk. Implemented as `font-display` utility + Tailwind `fontFamily.display`.

**Alternatives considered**: License Wise Sans — not available. Keep Circular/Airbnb stack — rejected.

## R3b — CSS variable mapping (implementation)

| DESIGN.md | CSS var | Notes |
|-----------|---------|-------|
| primary `#9fe870` | `--primary` | CTA only |
| on-primary `#0e0f0c` | `--primary-foreground` | Ink on lime |
| canvas-soft `#e8ebe6` | `--background`, `--surface-soft` | Page canvas |
| canvas `#ffffff` | `--card` | Cards / nav |
| ink `#0e0f0c` | `--foreground` | Text |
| body / mute | `--body` / `--muted-foreground` | Secondary |
| positive* | `--positive`, `--positive-deep` | Status ≠ CTA |
| negative | `--destructive` | Errors |
| rounded.xl 24px | `--radius` + Tailwind `xl` | Buttons/cards |
| rounded.md 12px | Tailwind `md` | Inputs |

Dark mode: light-first; `.dark` remapped away from Rausch but full dark polish deferred.

## R4 — Scope of visual redesign

**Decision**: Phased: (1) tokens + PWA theme_color, (2) Landing + Auth, (3) DashboardLayout + Button/Card/Input/Badge. Defer exhaustive feature-page restyles.

**Rationale**: Constitution: marketing/branded surfaces get DESIGN.md; preserve product workflows. Shell + primitives propagate brand into most screens.

**Alternatives considered**: Redesign all 40+ pages in one feature — rejected as too large / untestable.

## R5 — Cards vs product density

**Decision**: Marketing/auth use DESIGN.md cards freely. In-app: adopt radius/color tokens; avoid introducing decorative card chrome where existing dense tables/lists don’t need it (aligns with product UX; DESIGN.md cards remain available for empty states / pricing / billing summaries).

**Rationale**: User frontend rules discourage card spam in product UI; DESIGN.md cards are brand-correct on marketing and for interactive containers.

## R6 — Dark mode

**Decision**: Light-first. Keep `.dark` block compiling but map minimally for contrast OR document dark as deferred follow-up; do not block MVP.

**Rationale**: DESIGN.md is written for light sage/white surfaces. Half-migrated dark is worse than light-only polish.

## R7 — PWA / manifest

**Decision**: Update `theme_color` / related brand hex in `client/vite.config.ts` (and any manifest helpers) from `#ff385c` to primary lime or ink per brand guidance.

**Rationale**: SC-001 requires no default Rausch brand chrome.

## Resolved clarifications

No remaining `NEEDS CLARIFICATION` in Technical Context.
