# Implementation Plan: Mobile Core Features

**Branch**: `005-mobile-core-features` | **Date**: 2026-08-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/005-mobile-core-features/spec.md`

**Note**: Plan proceeded with release-scope **Option A (core only)** — the recommended default — because `/speckit-plan` was invoked without an explicit Q1 answer. Spec clarification markers were resolved accordingly.

## Summary

Harden the existing Expo mobile MVP (cold-start routing, unauthenticated auth errors, session cache isolation), then extend `mobile/` with core social workflows already available on web: content draft/publish/schedule, Connections (OAuth), Social Inbox replies, and schedule viewing — all against live `api-rust`, scoped by tenant + active workspace.

## Technical Context

**Language/Version**: TypeScript, React Native (Expo SDK ~57)

**Primary Dependencies**: Expo Router, `@tanstack/react-query`, `expo-secure-store`, `expo-auth-session` / `expo-web-browser` (OAuth), `expo-image-picker` (media attach), existing Wise token theme in `mobile/src/theme.ts`

**Storage**: `expo-secure-store` for session + active workspace/tenant; no new local DB

**Testing**: Manual quickstart validation (Expo Go / simulators); optional Jest later — not blocking MVP for this feature

**Target Platform**: iOS and Android via Expo

**Project Type**: Mobile application (`mobile/` Yarn workspace)

**Performance Goals**: Cold start to home ≤ 5s with valid session (SC-001); draft→publish happy path ≤ 3 minutes (SC-002); API timeouts remain ~10s with clear UX

**Constraints**: Online-first (no offline publish queue); reuse existing REST contracts; no new backend domains; no secrets in repo; RBAC respected client-side and enforced server-side

**Scale/Scope**: ~6–8 primary screens/flows (Auth harden, Content list/editor, Connections, Inbox, Schedule, existing Home/Profile); deferred: Ads, Brand Brain, Analytics, Team, Billing, Mail, Chatbot, WhatsApp hub

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Nest–Rust parity**: Mobile is a client of `api-rust` only; no new Nest-only routes for this feature
- [x] **II. Tenancy**: All content, connections, inbox, and schedule calls pass `tenantId` + `workspaceId` for the active workspace
- [x] **III. Secrets**: Only public Expo env (`EXPO_PUBLIC_*`); OAuth return URLs use app scheme; no secrets in plan/spec
- [x] **IV. Contracts**: Consume existing openapi routes; mobile client contract documented in `contracts/mobile-api.md`; manual quickstart verifies publish/inbox/connect
- [x] **V. Background work**: No new crons/queues; publish may enqueue server-side under existing `QUEUES_ENABLED` ownership
- [x] **Stack**: No schema migrations required; work stays in `mobile/` (+ env docs if needed)

Violations: none. Prior justification for parallel `mobile/` tree remains from `004-react-native-app`.

## Project Structure

### Documentation (this feature)

```text
specs/005-mobile-core-features/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── mobile-api.md
└── tasks.md             # /speckit-tasks (not this command)
```

### Source Code (repository root)

```text
mobile/
├── app/
│   ├── _layout.tsx              # Auth + workspace providers; cold-start routing
│   ├── index.tsx                # Redirect hub (fix spinner trap)
│   ├── (auth)/login.tsx|signup.tsx
│   └── (tabs)/
│       ├── _layout.tsx          # Home, Content, Connections, Inbox, Schedule, Profile
│       ├── index.tsx            # Workspaces
│       ├── content*.tsx         # List + editor (new)
│       ├── connections.tsx      # Publisher connect (new)
│       ├── inbox.tsx            # Social inbox (new)
│       ├── schedule.tsx         # Upcoming posts (new)
│       └── profile.tsx
├── src/
│   ├── lib/api.ts               # Auth split + content/social/inbox/media clients
│   ├── lib/auth-store.ts
│   ├── context/AuthContext.tsx
│   └── context/WorkspaceContext.tsx
api-rust/                        # Existing endpoints only (no new modules planned)
client/                          # Reference UX/API shapes only
```

**Structure Decision**: Extend existing `mobile/` package. Do not add a second mobile tree. Mirror web API shapes from `client/src/lib/api.ts` without importing DOM code.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Parallel `mobile/` tree (existing) | Native iOS/Android cannot ship inside Vite `client/` | Universal RN-web merge would risk web stability |
