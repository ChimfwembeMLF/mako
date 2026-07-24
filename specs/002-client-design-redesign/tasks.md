---
description: "Task list for client DESIGN.md UI redesign"
---

# Tasks: Client UI redesign from DESIGN.md

**Input**: Design documents from `/specs/002-client-design-redesign/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Manual only (quickstart) — no automated test tasks unless added later

**Organization**: By user story (tokens → marketing/auth → app shell)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Parallelizable (different files, no incomplete-task dependency)
- **[Story]**: [US1] / [US2] / [US3]
- Exact file paths in every task

## Path Conventions

- Tokens: `client/src/index.css`, `client/src/lib/design-tokens.ts`, `client/src/lib/mako-brand.ts`, `client/tailwind.config.ts`
- PWA: `client/vite.config.ts`
- Shells: `client/src/pages/LandingPage.tsx`, `client/src/pages/auth/Auth.tsx`, `client/src/components/DashboardLayout.tsx`
- Primitives: `client/src/components/ui/button.tsx`, `card.tsx`, `input.tsx`, `badge.tsx`
- SoT: `DESIGN.md`, contract `specs/002-client-design-redesign/contracts/ui-design-system.md`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm branch and inventory current Airbnb token usage

- [x] T001 Confirm branch `002-client-design-redesign` and review `DESIGN.md`, `specs/002-client-design-redesign/plan.md`, and `specs/002-client-design-redesign/contracts/ui-design-system.md`
- [x] T002 [P] Inventory Airbnb/Rausch token usage in `client/src/index.css`, `client/src/lib/design-tokens.ts`, `client/src/lib/mako-brand.ts`, `client/tailwind.config.ts`, and `client/vite.config.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Hex→HSL mapping notes and font-loading approach so US1 can land cleanly

**⚠️ CRITICAL**: Complete before story implementation

- [x] T003 Document chosen Wise Sans substitute (Manrope 800/900 or Inter 900) and target Google Fonts import strategy in `specs/002-client-design-redesign/research.md` (confirm R3 decision)
- [x] T004 [P] List exact `:root` CSS variable renames/additions needed to map DESIGN.md colors onto existing `hsl(var(--*))` consumers in a short note under `specs/002-client-design-redesign/contracts/ui-design-system.md` or research appendix

**Checkpoint**: Mapping + font choice locked — token implementation can begin

---

## Phase 3: User Story 1 - Design token foundation (Priority: P1) 🎯 MVP

**Goal**: Replace Airbnb Rausch defaults with DESIGN.md Wise-inspired CSS/Tailwind tokens and fonts so `bg-primary` and related utilities render lime CTA brand-wide.

**Independent Test**: Inspect `:root` on any page — `--primary` ≈ `#9fe870`, on-primary ink; soft canvas/ink match DESIGN.md; Inter + display substitute load; no `#ff385c` in token/PWA brand files.

### Implementation for User Story 1

- [x] T005 [US1] Replace `:root` (and minimal `.dark` if kept) color/radius CSS variables with DESIGN.md Wise-inspired HSL values in `client/src/index.css`
- [x] T006 [P] [US1] Update TypeScript token mirror to DESIGN.md values and remove Airbnb comments in `client/src/lib/design-tokens.ts`
- [x] T007 [P] [US1] Update brand helpers away from Rausch/`#ff385c` to Wise primary/ink/sage in `client/src/lib/mako-brand.ts`
- [x] T008 [US1] Align Tailwind `theme.extend` colors, `borderRadius`, and `fontFamily` (sans=Inter, display=Manrope/substitute) with DESIGN.md in `client/tailwind.config.ts`
- [x] T009 [US1] Load Inter + display substitute fonts (weights including 900 for display) via `@import` or equivalent in `client/src/index.css`
- [x] T010 [US1] Set canonical `--radius` / Tailwind radius so default card/button path supports 24px (`rounded-xl`) per DESIGN.md in `client/src/index.css` and `client/tailwind.config.ts`
- [x] T011 [P] [US1] Update PWA `theme_color` (and related brand hex) away from `#ff385c` in `client/vite.config.ts`
- [x] T012 [US1] Grep-verify zero default-brand `#ff385c` / `349 100% 61%` / `rausch` in token files listed in quickstart; fix any misses in those files

**Checkpoint**: US1 MVP — app-wide primary/surface tokens are Wise-inspired

---

## Phase 4: User Story 2 - Marketing & auth shells (Priority: P2)

**Goal**: Redesign Landing and Auth to sage hero / heavy display / lime CTA / soft auth card per DESIGN.md and UI contract.

**Independent Test**: Logged-out `/` and `/auth` on desktop + mobile — brand-forward first viewport; lime CTA on neutral; ~24px cards; OAuth provider colors preserved.

### Implementation for User Story 2

- [x] T013 [US2] Redesign marketing hero, nav, CTA, and content bands to DESIGN.md `hero-band` / `nav-bar` / `button-primary` / `content-band` patterns in `client/src/pages/LandingPage.tsx`
- [x] T014 [P] [US2] Redesign auth card, inputs, and primary submit to `ex-auth-form-card` / `text-input` / lime CTA in `client/src/pages/auth/Auth.tsx` (keep OAuth provider brand colors)
- [x] T015 [US2] Ensure landing/auth responsive stacking and ~48px CTA touch targets for &lt;768px in `client/src/pages/LandingPage.tsx` and `client/src/pages/auth/Auth.tsx`
- [x] T016 [US2] Spot-check legal layout inherits tokens at minimum (no Rausch chrome) in `client/src/pages/legal/LegalLayout.tsx` — light touch only unless broken

**Checkpoint**: Public brand surfaces match DESIGN.md

---

## Phase 5: User Story 3 - Product app shell restyle (Priority: P3)

**Goal**: Restyle DashboardLayout + shared Button/Card/Input/Badge primitives so product chrome matches marketing tokens without rewriting all feature pages.

**Independent Test**: Sign in → `/dashboard` — lime active nav; lime primary buttons; sage/white surfaces; smoke `/content`, `/scheduler`, `/billing`, `/settings`, `/publisher`.

### Implementation for User Story 3

- [x] T017 [US3] Restyle sidebar/nav active indicator and shell chrome to use primary lime + soft canvas surfaces in `client/src/components/DashboardLayout.tsx`
- [x] T018 [P] [US3] Align primary/secondary/outline Button variants with DESIGN.md `button-primary` / `button-secondary` / `button-tertiary` (24px radius) in `client/src/components/ui/button.tsx`
- [x] T019 [P] [US3] Align Card defaults with `card-content` (24px radius, white on soft canvas) in `client/src/components/ui/card.tsx`
- [x] T020 [P] [US3] Align Input chrome with `text-input` (`rounded-md` 12px, ink border) in `client/src/components/ui/input.tsx`
- [x] T021 [P] [US3] Align Badge variants with semantic positive/negative recipes (not CTA lime for success) in `client/src/components/ui/badge.tsx`
- [x] T022 [US3] Smoke-navigate authenticated routes `/dashboard`, `/content`, `/scheduler`, `/billing`, `/settings`, `/publisher` and fix shell/primitive regressions only (no full page rewrites)

**Checkpoint**: Product shell + primitives consistent with DESIGN.md

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Quickstart pass and residual brand cleanup

- [x] T023 [P] Run full manual checklist in `specs/002-client-design-redesign/quickstart.md` and note any deferred hard-coded Rausch leftovers outside token/shell scope
- [x] T024 [P] Update obsolete “Airbnb-inspired” comments in `client/src/lib/design-tokens.ts` / related files to reference Wise-inspired `DESIGN.md`
- [x] T025 Confirm light-first dark-mode stance (fix `.dark` contrast or document deferred) in `client/src/index.css` and `specs/002-client-design-redesign/research.md`
- [x] T026 Confirm no API/route/auth logic changes — presentation-only diff under `client/`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Immediate
- **Foundational (Phase 2)**: After Setup — blocks stories
- **US1 (Phase 3)**: After Phase 2 — **MVP**
- **US2 (Phase 4)**: After US1 tokens (needs lime/sage utilities)
- **US3 (Phase 5)**: After US1; can overlap late US2 if staffed
- **Polish (Phase 6)**: After desired stories

### User Story Dependencies

- **US1**: No story dependencies — unlocks brand everywhere via CSS vars
- **US2**: Depends on US1 tokens/fonts
- **US3**: Depends on US1; primitives independent of landing copy

### Parallel Opportunities

- T002 with doc skim after T001
- T006 ∥ T007 after T005 starts (careful if sharing constants)
- T011 ∥ token TS updates
- T013 ∥ T014 after US1
- T018–T021 in parallel after T017 or alongside if files don’t conflict

---

## Parallel Example: User Story 1

```bash
# After T005 starts / completes:
Task: "Update design-tokens.ts"
Task: "Update mako-brand.ts"
Task: "Update vite.config.ts theme_color"
# Then tailwind + fonts + grep verify
```

## Parallel Example: User Story 3

```bash
Task: "Restyle button.tsx"
Task: "Restyle card.tsx"
Task: "Restyle input.tsx"
Task: "Restyle badge.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1–2 setup/foundation  
2. Phase 3 tokens + fonts + PWA  
3. **STOP**: Verify primary is lime app-wide via DevTools  
4. Demo/deploy client if token-only ship is enough  

### Incremental Delivery

1. US1 → brand flips everywhere `bg-primary` is used  
2. US2 → landing/auth brand test passes  
3. US3 → dashboard shell + primitives  
4. Polish → quickstart + comment cleanup  

### Parallel Team Strategy

1. Dev A: tokens (US1)  
2. After US1: Dev B landing, Dev C auth, Dev D shell/primitives  

---

## Notes

- Do **not** force lime onto OAuth provider buttons  
- Do **not** use primary lime as success/status green — use semantic positive  
- Do **not** rewrite all feature pages in this feature  
- Proprietary Wise Sans not required — Manrope/Inter 900 per research  

---

## Task Summary

| Phase | Tasks | Count |
|-------|-------|-------|
| Setup | T001–T002 | 2 |
| Foundational | T003–T004 | 2 |
| US1 (P1 MVP) | T005–T012 | 8 |
| US2 (P2) | T013–T016 | 4 |
| US3 (P3) | T017–T022 | 6 |
| Polish | T023–T026 | 4 |
| **Total** | T001–T026 | **26** |

---

## Phase 7: Convergence

**Purpose**: Close gaps found by `/speckit-converge` against spec/plan/tasks vs current code

- [X] T027 Update `theme-color` meta in `client/index.html` to Wise primary `#9fe870` (align with `client/vite.config.ts`) per FR-008 / SC-001 (partial)
- [X] T028 [P] Replace pricing/feature success checkmark `text-primary` with semantic `text-positive-deep` in `client/src/pages/LandingPage.tsx` per DESIGN Do’s / Edge Cases (partial)
- [X] T029 [P] Replace remaining `rounded-lg` overrides with `rounded-xl` on landing CTAs/icons in `client/src/pages/LandingPage.tsx` per US2 / FR-003 (partial)
- [X] T030 [P] Align `FormTextarea` and `formSelectTriggerClass` in `client/src/components/forms/FormInput.tsx` to ink-border `rounded-md` text-input recipe per US2 / contracts (partial)

## Phase 8: Convergence

**Purpose**: Close gaps found by `/speckit-converge` against spec/plan/tasks vs current code

- [X] T031 [P] Align `Textarea` defaults to DESIGN.md `text-input` (`rounded-md` 12px, ink `border-foreground`, canvas bg) in `client/src/components/ui/textarea.tsx` per FR-003 / contracts (partial)
- [X] T032 [P] Align `SelectTrigger` defaults to DESIGN.md `text-input` (`rounded-md` 12px, ink border) in `client/src/components/ui/select.tsx` per FR-003 / FR-006 / contracts (partial)
