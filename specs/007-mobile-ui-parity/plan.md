# Implementation Plan: Mobile UI Parity & Missing Components

**Branch**: `007-mobile-ui-parity` | **Date**: 2026-08-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/007-mobile-ui-parity/spec.md`

## Summary

Bring the Expo mobile app to visual and navigational parity with the web **Social shell**: finish the shared Wise-inspired design system (tokens, typography, toasts, empty/loading states), add an app shell with workspace switcher and permission-filtered **More** menu, harden core social screens already started in-session (calendar scheduler, inbox bubbles, platform-branded connections), then add missing product routes (Brand Brain, Media, Templates, Campaigns, Analytics snapshot, Settings, Team, Approvals, Leads, Mail summary, WhatsApp status, auto-reply rules) by extending `mobile/src/lib/api.ts` from `client/src/lib/api.ts` patterns — **mobile-only** unless Rust endpoint gaps are discovered during implementation (document in `api/docs/RUST_MIGRATION.md`).

## Technical Context

**Language/Version**: TypeScript, React Native (Expo SDK ~57), React 19; Rust (`api-rust`) read-only unless gap found

**Primary Dependencies**: Expo Router, React Query, SecureStore, `@expo-google-fonts/inter` + `manrope`, `expo-symbols`, existing UI primitives under `mobile/src/components/ui/`; mirror web nav from `client/src/lib/nav-config.ts` and API from `client/src/lib/api.ts`

**Storage**: SecureStore (native) / `localStorage` (web dev) for session; AsyncStorage for onboarding-dismiss flag and theme preference cache; no new server schema

**Testing**: Manual device quickstart with recorded pass/fail; UI audit checklist for six core tabs; permission-matrix spot checks for More menu items

**Target Platform**: iOS, Android (primary); Expo Web for local dev (CORS + SecureStore fallbacks already handled)

**Project Type**: Mobile application (`mobile/`) consuming live `api-rust` (Nest `yarn dev` acceptable for local dev only)

**Performance Goals**: Core tab navigation < 300ms perceived; list screens paginate/invalidate without full-app reload; calendar month render at 60fps on mid-range devices

**Constraints**: Online-first; deferred megas per FR-016; RBAC fail-closed; no secrets in mobile bundle beyond `EXPO_PUBLIC_*`; bottom tabs stay primary IA

**Scale/Scope**: ~15 new stack routes under `mobile/app/(tabs)/more/` or `(tabs)/` groups; ~8 new UI primitives; extend `api.ts` with ~20 endpoint wrappers; refactor existing six tabs to shared shell

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Nest–Rust parity**: Feature is mobile-client-first. New surfaces call existing HTTP routes documented in `contracts/mobile-api.md`. Any Nest-only route discovered during implement MUST be ported to `api-rust` or documented as temporary gap — not shipped as mobile-only fiction.
- [x] **II. Tenancy**: Every new list/mutation includes `tenantId` + active `workspaceId`; More menu filtered by `useEffectivePermissions` expanded beyond publish/reply/create/edit.
- [x] **III. Secrets**: Only `EXPO_PUBLIC_*`; forgot-password uses public endpoint; OAuth unchanged from 006.
- [x] **IV. Contracts**: Extended `contracts/mobile-api.md` + new `contracts/ui-shell.md`; quickstart covers shell audit + eight new destinations.
- [x] **V. Background work**: No new crons/queues.
- [x] **Stack**: No TypeORM migrations; Docker/Dokploy unchanged.

Violations: none beyond existing justified parallel `mobile/` tree (004).

## Project Structure

### Documentation (this feature)

```text
specs/007-mobile-ui-parity/
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1 validation
├── contracts/
│   ├── mobile-api.md    # Extended HTTP contract
│   └── ui-shell.md      # Navigation + component inventory
└── tasks.md             # /speckit-tasks (not this command)
```

### Source Code (repository root)

```text
mobile/
├── app/
│   ├── _layout.tsx                    # Fonts, SafeArea, theme provider
│   ├── (auth)/                        # + forgot-password route
│   └── (tabs)/
│       ├── _layout.tsx                # Tab bar + shell header slot
│       ├── index.tsx                  # Social dashboard (not workspace-only)
│       ├── content/ | inbox/ | schedule/ | connections/ | profile/
│       └── more/                      # NEW: stack for Brand Brain, Media, …
│           ├── _layout.tsx
│           ├── index.tsx              # More menu (permission-filtered)
│           ├── brand-brain.tsx
│           ├── media.tsx
│           ├── templates.tsx
│           ├── campaigns.tsx
│           ├── analytics.tsx
│           ├── settings.tsx
│           ├── team.tsx
│           ├── approvals.tsx
│           ├── leads.tsx
│           ├── mail.tsx
│           ├── whatsapp.tsx
│           └── auto-reply-rules.tsx
├── src/
│   ├── components/
│   │   ├── ui/                        # + Toast, EmptyState, Skeleton, Sheet, SegmentedControl
│   │   ├── AppShellHeader.tsx         # Workspace switcher + title
│   │   ├── ScheduleCalendar.tsx       # (started)
│   │   └── OnboardingHint.tsx
│   ├── constants/
│   │   ├── platforms.ts
│   │   └── mobile-nav.ts              # Mirror SOCIAL_NAV + MORE_ITEMS subset
│   ├── context/
│   │   ├── ThemeContext.tsx           # Light/dark tokens
│   │   └── ToastContext.tsx
│   ├── hooks/
│   │   ├── useAppFonts.ts
│   │   └── useEffectivePermissions.ts # Expand permission keys
│   ├── lib/
│   │   ├── api.ts                     # + brand, media list, templates, campaigns, analytics, team, …
│   │   └── dates.ts
│   └── theme.ts                       # + dark palette
client/src/lib/nav-config.ts           # Reference for destinations + permissions
api/docs/RUST_MIGRATION.md             # Update if endpoint gaps found
```

**Structure Decision**: Extend `mobile/` only; map routes from web `SOCIAL_NAV_GROUPS` + permission-filtered subset of `MORE_ITEMS`. Do not duplicate web pages inside `client/`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Parallel `mobile/` tree (existing) | Native shell required | Responsive web-only layout insufficient for App Store / device QA |
| Many new stack screens | FR-008/FR-009 require distinct destinations | Single WebView of SPA breaks offline banner, OAuth return URLs, and native UX |

## Phase Overview

| Phase | Focus | Deliverables |
|-------|--------|--------------|
| **P1 Shell** | Design system completion, AppShellHeader, Toast, EmptyState, workspace switcher, tab polish | US1, partial US2 |
| **P1 Core** | Finish calendar/list scheduler, inbox bubbles, connections cards, editor polish | US2 |
| **P2 Surfaces** | Brand Brain, Media picker in editor, Templates apply, Campaigns list, Analytics snapshot, Settings | US3 |
| **P3 Ops** | Team, Approvals, Leads, Mail read, WhatsApp status, Auto-reply rules, forgot-password, onboarding, dark theme | US4, US5 |

## Post-Design Constitution Re-check

- [x] All new data paths scoped by tenant/workspace
- [x] No backend domains invented; contracts list existing REST paths from web client
- [x] Deferred items (ads, chatbot authoring, billing checkout, super-admin, export, push, drag-drop reschedule) excluded from acceptance
