# Implementation Plan: Mobile Core Hardening

**Branch**: `006-mobile-core-hardening` | **Date**: 2026-08-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/006-mobile-core-hardening/spec.md`

## Summary

Harden the converged Expo mobile core from `005-mobile-core-features`: fix false-success replies and stale publish-now, make media attach reliable (deps, permissions, refresh-aware upload), close inbox comment parity vs web, align publish destinations with connected accounts, expand Connections OAuth toward web publisher platforms, and polish schedule/media/Google config + recorded device QA — primarily in `mobile/`, with a small `api-rust` inbox conversations parity fix so post-comment threads appear on the live runtime.

## Technical Context

**Language/Version**: TypeScript, React Native (Expo SDK ~57); Rust (api-rust) for one inbox list parity fix

**Primary Dependencies**: Existing Expo Router, React Query, SecureStore, WebBrowser OAuth, `expo-image-picker` (must be locked/installed); mirror web shapes from `client/src/lib/api.ts` / `UnifiedSocialInbox` / `PublisherConnect`

**Storage**: SecureStore session + workspace; no new local DB; no schema migrations

**Testing**: Manual device quickstart with recorded pass/fail (`quickstart.md`); optional smoke for inbox conversations if Rust list changes

**Target Platform**: iOS and Android via Expo

**Project Type**: Mobile application (`mobile/`) + minimal live-API parity in `api-rust/`

**Performance Goals**: Reply failure UX immediate; save-then-publish keeps SC publish path under ~3 minutes; media attach under 2 minutes when permitted (SC-003)

**Constraints**: Online-first; no Approvals/Campaigns/deferred megas; no secrets; RBAC fail-closed; WhatsApp hub/templates out of scope (publisher WhatsApp connect allowed if web already offers it)

**Scale/Scope**: Hardening existing Content / Connections / Inbox / Schedule / Auth screens; add comment-replies client helpers; OAuth finalize sheets for YouTube (+ WhatsApp phone pick if included); optional TikTok/Twitter connect parity

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Nest–Rust parity**: Mobile remains a client of live `api-rust`. Planned Rust change: `GET /api/v1/inbox/conversations` must include `post_comment` rows (Nest `unified-inbox.service` already does; Rust currently returns `[]` for that channel). Document in research; no Nest-only feature shipping.
- [x] **II. Tenancy**: All content, media, connections, inbox, comment-replies calls keep `tenantId` + `workspaceId`.
- [x] **III. Secrets**: Only `EXPO_PUBLIC_*`; remove dummy Google client ID fallbacks; OAuth return URLs use app scheme.
- [x] **IV. Contracts**: Extended `contracts/mobile-api.md`; quickstart covers reply soft-fail, save-before-publish, comments, destinations, media; Rust inbox list change verifiable via manual/quickstart (and Nest parity note).
- [x] **V. Background work**: No new crons/queues; existing publish/inbox sync ownership unchanged.
- [x] **Stack**: No TypeORM migrations; Docker/Dokploy unchanged except consuming existing APIs.

Violations: none beyond existing justified parallel `mobile/` tree (004).

## Project Structure

### Documentation (this feature)

```text
specs/006-mobile-core-hardening/
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
├── app/(tabs)/
│   ├── connections.tsx          # Expand platforms + finalize sheets
│   ├── inbox/index.tsx|[id].tsx # Channel filters; DM + comment threads; sent check
│   ├── schedule.tsx             # Explicit cancel-schedule
│   └── content/*                # Via ContentEditorScreen
├── app/(auth)/login.tsx|signup.tsx  # No dummy Google IDs
├── src/
│   ├── components/ContentEditorScreen.tsx  # Save-before-publish; destinations; media; RBAC create/edit
│   ├── hooks/useEffectivePermissions.ts    # content.create / content.edit
│   └── lib/api.ts               # upload refresh; comment-replies; reply typed {sent}
api-rust/src/modules/social_inbox/mod.rs   # conversations include post_comment (Nest parity)
client/                                  # Reference only (UnifiedSocialInbox, PublisherConnect)
```

**Structure Decision**: Extend `mobile/` from 005; one focused `api-rust` inbox list parity change so FR-005 works on production runtime. Do not invent a second mobile tree.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Parallel `mobile/` tree (existing) | Native iOS/Android cannot ship inside Vite `client/` | Universal RN-web merge would risk web stability |
| Small `api-rust` inbox conversations change | Nest already merges post_comment; Rust returns empty → mobile/web live API cannot list comments | Mobile-only client merge of `comment-replies/inbox` works for threads but leaves Constitution I gap and broken channel filter on Rust |
