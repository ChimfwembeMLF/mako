# Phase 0: Research — Mobile Core Features

## 1. Release scope

- **Decision**: Core social ops only (Option A) — session hardening + content + Connections + Social Inbox + schedule view.
- **Rationale**: Matches recommended default from specify Q1; delivers usable on-the-go value without boiling the ocean.
- **Alternatives considered**: Core+WhatsApp hub (B); broad web parity (C) — deferred to later features.

## 2. Auth reliability (cold start + login 401)

- **Decision**:
  1. Root `app/index.tsx` / `_layout` redirect: valid session → `/(tabs)`; no session → `/(auth)/login`.
  2. Split API helpers: `fetchPublic` (login/register/google/refresh) never runs 401→refresh→signOut; `fetchWithAuth` keeps refresh for authenticated routes.
  3. On sign-out: `clearSession` + React Query `queryClient.clear()`.
- **Rationale**: Fixes critical review findings that block SC-001/SC-003.
- **Alternatives considered**: Single fetch wrapper with `requireAuth` flag (acceptable equivalent); ignoring cache clear (rejected — cross-user leak).

## 3. Content create / publish / schedule

- **Decision**: Use existing `api-rust` `content-items` CRUD + `POST /api/v1/content-ai/{id}/publish` (same as web). Schedule by setting scheduled fields on the content item / publish payload as web does today. Media via `expo-image-picker` → `POST /api/v1/media/upload` → attach to item.
- **Rationale**: No new backend; proven web path.
- **Alternatives considered**: Mobile-only draft store (rejected — breaks workspace sync); AI generate-first UX (deferred — Brand Brain/AI out of scope).

## 4. Social Connections on mobile

- **Decision**: Reuse `GET /api/v1/social-accounts/oauth/{platform}/authorize` with `returnUrl` pointing at Expo linking / HTTPS callback the API already supports for web-style return, then deep-link back into the app. Start with Facebook, Instagram, LinkedIn (same primary web set); other platforms follow if authorize already works.
- **Rationale**: Same OAuth state machine as web Publisher Connect.
- **Alternatives considered**: Manual token paste (rejected — poor UX/security); native-only SDKs per platform (rejected — Expo Go friction).

## 5. Social Inbox

- **Decision**: Use unified inbox APIs: `GET /api/v1/inbox/conversations`, `GET /api/v1/inbox/messages`, `POST /api/v1/inbox/messages/reply`, optional `POST /api/v1/inbox/sync`, always with `tenantId` + `workspaceId`.
- **Rationale**: One inbox surface covers comments/DMs the product already unifies; avoids duplicating comment-replies-only UI.
- **Alternatives considered**: Comments-only tab first (acceptable subset, but unified inbox matches US4); WhatsApp templates hub (out of scope).

## 6. Schedule view

- **Decision**: List content items filtered/sorted by scheduled status/time for active workspace (`content-items` with workspace scope); detail opens existing editor actions (cancel schedule / publish-now when API + RBAC allow).
- **Rationale**: Avoids inventing a separate calendar service.
- **Alternatives considered**: Full calendar grid (deferred polish); web-only schedule (rejects US5).

## 7. Permissions / RBAC

- **Decision**: Hide or disable publish/reply actions when `/auth/me` (or existing membership payload) indicates insufficient rights; always rely on API 403 for enforcement.
- **Rationale**: Constitution II — client UX + server enforcement.
- **Alternatives considered**: Client-only checks (rejected).

## 8. Offline

- **Decision**: Keep online-first with existing timeout/offline error strings; add a simple banner on main tabs when a request fails with offline message. No offline draft sync queue in this release.
- **Rationale**: Spec FR-011; push/offline queue out of assumptions.
- **Alternatives considered**: Full offline-first (out of scope).
