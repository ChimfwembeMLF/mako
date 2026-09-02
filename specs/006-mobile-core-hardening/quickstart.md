# Quickstart Validation — Mobile Core Hardening

## Prerequisites

1. Repo root: `yarn install` so `expo-image-picker` is in lockfile + `mobile/node_modules`.
2. `api-rust` reachable; `EXPO_PUBLIC_API_URL` set (LAN IP for physical device).
3. Test user with tenant + workspace; at least one connected account for publish scenarios.
4. Optional: workspace with both DMs and post comments for inbox parity.
5. Google env: either real `EXPO_PUBLIC_GOOGLE_*` or leave unset to verify config error (scenario 10).

## Setup

```bash
cd mobile
npx expo start
```

## Scenarios

### 1. Reply soft-fail (SC-001 / US1)

1. Open a conversation that cannot send (e.g. disconnected platform) **or** force API `{ sent: false }`.
2. Send a reply with text.
3. **Expected**: Error visible; composer text retained; no “success” implication.

### 2. Reply success (US1)

1. Open a sendable DM; send reply.
2. **Expected**: Composer clears; thread updates (or clear refresh error).

### 3. Save-before-publish (SC-002 / US1)

1. Open an **existing** draft; change body text; do **not** tap Save.
2. Tap Publish now (connected destination selected).
3. **Expected**: Published/queued content reflects the edited text.

### 4. Media attach + permission (SC-003 / US2)

1. New or existing draft → Add image; grant library permission if prompted.
2. **Expected**: Preview shown; save/publish can attach.
3. Deny permission (or revoke in OS settings) and retry.
4. **Expected**: Clear explanation — not silent no-op.

### 5. Comment + DM inbox (SC-004 / US3)

1. Sync inbox on a workspace with comments and DMs.
2. Filter All / Comments / Messages.
3. Open a comment thread; reply.
4. **Expected**: Both types listed; reply success or clear failure (`sent` respected).

### 6. Destinations ⊆ connections (SC-005 / US4)

1. Connect only one network (e.g. Facebook).
2. Open Content editor.
3. **Expected**: Other networks not freely publishable; guidance to Connections.

### 7. Extra network connect (US4)

1. Connections → start YouTube (or TikTok/X/WhatsApp publisher) per available providers.
2. Complete OAuth/finalize.
3. **Expected**: Account listed; becomes selectable for publish.

### 8. Cancel schedule + existing media (US5)

1. Schedule a post; open Schedule → cancel schedule.
2. **Expected**: Removed from scheduled list / status draft.
3. Open a draft that already has media.
4. **Expected**: Existing media visible.

### 9. Cold start + bad password (regression)

1. Valid session → force-quit → reopen → tabs quickly.
2. Sign out → wrong password → credentials error (not false session expired).

### 10. Google config (FR-010)

1. With Google env unset, open login.
2. **Expected**: Clear config error / disabled Google — no dummy client ID behavior.

### 11. Workspace isolation

1. Switch workspace; re-open Content / Inbox / Schedule.
2. **Expected**: Only new workspace data.

## Results log (required for FR-014 / SC-006)

| # | Scenario | Pass/Fail | Notes | Tester | Date |
|---|----------|-----------|-------|--------|------|
| 1 | Reply soft-fail | | | | |
| 2 | Reply success | | | | |
| 3 | Save-before-publish | | | | |
| 4 | Media attach | | | | |
| 5 | Comment + DM inbox | | | | |
| 6 | Destinations | | | | |
| 7 | Extra connect | | | | |
| 8 | Schedule cancel / media | | | | |
| 9 | Cold start / bad password | | | | |
| 10 | Google config | | | | |
| 11 | Workspace isolation | | | | |

> **T022 pending**: Implementation is in place; fill this table on a real device/simulator before marking the feature fully accepted.
