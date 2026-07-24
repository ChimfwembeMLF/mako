# Data Model: 002-client-design-redesign

Presentation-only feature. “Entities” are design-system concepts, not DB tables.

## DesignTokenSet

| Field group | Examples | Source |
|-------------|----------|--------|
| colors.primary / on-primary / primary-* | `#9fe870`, `#0e0f0c`, `#cdffad`, … | DESIGN.md `colors` |
| colors.canvas / canvas-soft | `#ffffff`, `#e8ebe6` | DESIGN.md |
| colors.ink / body / mute | `#0e0f0c`, `#454745`, `#868685` | DESIGN.md |
| colors.semantic | positive*, warning*, negative* | DESIGN.md |
| colors.accent (tertiary) | orange, cyan — illustration only | DESIGN.md |
| typography.* | display-mega…caption, button-md | DESIGN.md |
| rounded.* | none…full; **xl = 24px** canonical | DESIGN.md |
| spacing.* | xxs…3xl; base 4px | DESIGN.md |

**Validation**

- Primary CTA color MUST NOT equal semantic positive.
- Hero display weight MUST be 900 (or substitute max weight).
- Card/button radius default MUST be 24px (`rounded.xl`).

## SurfaceShell

| Shell | Route(s) | DESIGN.md recipes |
|-------|----------|-------------------|
| Landing | `/`, `/home` (logged out) | `hero-band` / `nav-bar` / `button-primary` / `content-band` / `footer` |
| Auth | `/auth` | `ex-auth-form-card`, `text-input`, `button-primary` |
| App shell | `DashboardLayout` children | `ex-app-shell-row`, tokens on primitives |

## UIPrimitive mapping

| Primitive | Recipe | Notes |
|-----------|--------|-------|
| Button primary | `button-primary` | Lime on ink text |
| Button secondary | `button-secondary` | Sage fill |
| Button outline/tertiary | `button-tertiary` | Ink hairline |
| Card | `card-content` (+ variants) | White on sage |
| Input | `text-input` | `rounded.md` 12px |
| Badge | `badge-positive` / `badge-negative` | Semantic colors |

## Relationships

```text
DESIGN.md → DesignTokenSet → CSS :root + Tailwind
                         ↘ UIPrimitive defaults
SurfaceShell → consumes tokens + primitives
Feature pages → inherit via primitives (v1); explicit restyle later
```

## State transitions

None (no domain state). Visual migration order:

1. Tokens live → all `bg-primary` consumers flip
2. Landing/Auth compositions updated
3. DashboardLayout + primitive recipes updated
