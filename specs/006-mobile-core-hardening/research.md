# Research: Mobile Core Hardening

## 1. Reply soft-fail (`sent: false`)

- **Decision**: Treat `POST /api/v1/inbox/messages/reply` (and comment send) as failed unless `sent === true`. Keep composer text; show `message` from body. Mirror web `UnifiedSocialInbox`.
- **Rationale**: api-rust often returns HTTP 200 with `{ sent: false, message }` for disconnected accounts and non-DM conversation IDs.
- **Alternatives considered**: Rely on HTTP status only (rejected — false success).

## 2. Save-before-publish

- **Decision**: On Publish now for existing drafts, always run the same save/update path used by Save draft (including pending media attach) before `content-ai/.../publish`.
- **Rationale**: Spec FR-002 / SC-002; current code only saves when `isNew`.
- **Alternatives considered**: Prompt “Save first?” (worse UX); publish then PATCH (race / wrong published body).

## 3. Media picker dependency + permissions

- **Decision**: Ensure `expo-image-picker` is installed and present in root `yarn.lock`; call `requestMediaLibraryPermissionsAsync` before `launchImageLibraryAsync`; surface denied-permission copy. Remove stub-only typing once package resolves.
- **Rationale**: Package listed in `mobile/package.json` but missing from lockfile → runtime break.
- **Alternatives considered**: Camera-only capture (rejects library attach story).

## 4. Refresh-aware media upload

- **Decision**: Route media upload through the same 401→refresh→retry path as `fetchWithAuth` (shared helper or multipart variant), then sign out on hard failure.
- **Rationale**: FR-004; raw `fetch` today skips refresh.
- **Alternatives considered**: Manual re-login only (worse mid-draft UX).

## 5. Post-comment inbox parity

- **Decision**:
  1. **api-rust**: Extend `GET /api/v1/inbox/conversations` to emit `post_comment` conversations from comment-reply data when `channel` is `all` or `post_comment`, matching Nest `unified-inbox.service.ts` (today Rust returns `[]` for `post_comment`).
  2. **mobile**: Channel filter (All / Comments / Messages); for comment threads load via `comment-replies` inbox/fetch/send APIs like web; always check `sent` on send.
- **Rationale**: Constitution I — live runtime is Rust; mobile-only merge leaves broken channel filter and web gap.
- **Alternatives considered**: Client-only merge of `comment-replies/inbox` without Rust fix (partial); Nest-only (rejects Constitution I).

## 6. Destinations vs connected accounts

- **Decision**: Derive selectable publish platforms from `listSocialAccounts` for the active workspace; disable/hide others with link to Connections.
- **Rationale**: FR-006 / SC-005; reduces late publish failures.
- **Alternatives considered**: Keep free chips and only validate on publish (status quo — rejected).

## 7. Broader Connections OAuth

- **Decision**: Add YouTube (setup + channel finalize), TikTok, Twitter/X, and WhatsApp **publisher** connect/finalize sheets mirroring `PublisherConnect.tsx`. Exclude WhatsApp hub/templates UI (FR-015).
- **Rationale**: Spec FR-007; web already exposes these OAuth platforms.
- **Alternatives considered**: Chip-alignment only without new connects (insufficient for FR-007); full WhatsApp hub (deferred).

## 8. Google client IDs

- **Decision**: Require `EXPO_PUBLIC_GOOGLE_*` (or documented public client env); if missing, disable Google button with clear config error — never use `dummy-*-client-id`.
- **Rationale**: FR-010.
- **Alternatives considered**: Keep dummy fallbacks for storybook (confuses QA).

## 9. Create/edit RBAC

- **Decision**: Extend `useEffectivePermissions` with `content.create` / `content.edit`; disable save/mutate when denied; keep publish/reply gates; server 403 remains authoritative.
- **Rationale**: FR-011.
- **Alternatives considered**: Approvals queue (out of scope).

## 10. Schedule cancel + existing media

- **Decision**: Explicit “Cancel schedule” sets status to draft and clears schedule fields via PATCH; load and display `item.media` URLs when opening editor.
- **Rationale**: FR-008 / FR-009.
- **Alternatives considered**: Only clear date silently (fails “explicit” cancel).

## 11. Device QA recording

- **Decision**: Expand `quickstart.md` with hardening scenarios; implementers record pass/fail in the Results table before marking feature complete (FR-014 / SC-006).
- **Rationale**: Prior T030 was unchecked on device.
- **Alternatives considered**: Automated Detox suite (nice-to-have, not blocking this feature).
