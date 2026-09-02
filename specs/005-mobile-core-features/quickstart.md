# Quickstart Validation — Mobile Core Features

## Prerequisites

1. `api-rust` running and reachable from the device/simulator (`EXPO_PUBLIC_API_URL`).
2. Yarn install at repo root; `mobile` workspace present.
3. Test user with a tenant, workspace, and (for publish/inbox) at least one connected social account — or use Connections flow in scenario 3.
4. Expo Go or iOS/Android simulator.

## Setup

```bash
cd mobile
# Ensure EXPO_PUBLIC_API_URL points at api-rust (LAN IP for physical devices)
npx expo start
```

## Scenarios

### 1. Cold start with session (SC-001 / US1)

1. Sign in successfully once.
2. Force-quit the app; reopen.
3. **Expected**: Main tabs within ~5s — not an indefinite spinner on `/`.

### 2. Invalid password (SC-003 / US1)

1. Sign out.
2. Enter wrong password.
3. **Expected**: Credentials error (not “session expired”); can retry.

### 3. Connect account (US3)

1. Open **Connections**.
2. Connect Facebook or Instagram (or LinkedIn).
3. Complete provider consent; return to app.
4. **Expected**: Account listed for active workspace.

### 4. Draft → publish (SC-002 / US2)

1. Open **Content** → new post; enter text; optional image.
2. Select a connected platform → Publish.
3. **Expected**: Success or clear per-destination failure within 3 minutes.

### 5. Schedule (US2 / US5)

1. Create or open a draft → schedule for a near-future time.
2. Open **Schedule**.
3. **Expected**: Item visible with time/status.

### 6. Inbox reply (US4)

1. Ensure a comment/DM exists (or sync inbox).
2. Open **Inbox** → reply.
3. **Expected**: Reply sent or clear error; thread updates.

### 7. Workspace isolation (SC-004 / FR-009)

1. Switch workspace on Home.
2. Re-open Content / Inbox / Schedule.
3. **Expected**: Only that workspace’s data; no bleed from previous.

### 8. Sign-out cache (US1)

1. Sign out; sign in as a different user (or clear and use another account).
2. **Expected**: No previous profile/workspace lists flash as the other user’s data.

## References

- [contracts/mobile-api.md](./contracts/mobile-api.md)
- [data-model.md](./data-model.md)
- [spec.md](./spec.md)
