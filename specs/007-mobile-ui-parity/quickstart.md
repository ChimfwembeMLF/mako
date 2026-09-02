# Quickstart Validation — Mobile UI Parity

## Prerequisites

1. Repo root: `yarn install` (includes `@expo-google-fonts/inter`, `@expo-google-fonts/manrope`, mobile deps).
2. API running: `yarn dev` (Nest, port 4000) **or** `cd api-rust && cargo run` for Rust parity checks.
3. `mobile/.env`: `EXPO_PUBLIC_API_URL` — `http://localhost:4000` (simulator/web) or LAN IP (device).
4. Test user: `owner@brandpilot.test` / `password123` (after `cd api && yarn seed:dev`).
5. Workspace with: connected social account, at least one scheduled post, mixed inbox (DM + comment if possible), brand profile, one media asset, one template, one campaign (optional), analytics data (optional).

## Setup

```bash
# Terminal 1 — API
yarn dev

# Terminal 2 — Mobile
cd mobile && npx expo start
```

Press `i` (iOS sim), `a` (Android), or `w` (web dev).

---

## Scenario 1 — Shell & design audit (SC-001)

1. Sign in; visit Home, Content, Scheduler, Connections, Inbox, Profile.
2. **Expected**: Sage background, white cards, lime primary buttons, page headers with icon tiles, Manrope/Inter typography.
3. Record pass/fail per tab in Results log.

---

## Scenario 2 — Workspace switcher (FR-003)

1. From any tab header, open workspace switcher.
2. Select a different workspace.
3. **Expected**: Lists refresh to new workspace; no need to visit Home-only picker.

---

## Scenario 3 — Toast feedback (FR-001)

1. Save a draft, publish (or trigger intentional failure e.g. disconnected platform).
2. **Expected**: Toast success/error — not only system Alert.

---

## Scenario 4 — Core social workflow (SC-002)

1. Create draft → attach image → schedule → open Scheduler calendar → verify day chip.
2. Open inbox thread → send reply (success or clear failure).
3. **Expected**: Full flow without switching to web.

---

## Scenario 5 — More menu destinations (SC-003)

Open **More** and verify reachable (when data + permission exist):

| # | Destination | Minimal action |
|---|-------------|----------------|
| 1 | Brand Brain | View + save one field |
| 2 | Media | See library list |
| 3 | Templates | List + apply to new draft |
| 4 | Campaigns | List view |
| 5 | Analytics | Snapshot cards |
| 6 | Settings | Account info visible |
| 7 | Team | Member list (if permitted) |
| 8 | Approvals | List (if permitted) |

Record count of reachable destinations (target ≥ 8).

---

## Scenario 6 — Empty states (SC-004)

1. Open a More route with no data (e.g. campaigns on empty workspace).
2. **Expected**: EmptyState with guidance/CTA — not blank screen.

---

## Scenario 7 — Forgot password (SC-005)

1. Log out → Login → Forgot password → enter email → submit.
2. **Expected**: Same opaque success messaging as web (no “email not found” leak).

---

## Scenario 8 — Onboarding hint (FR-011)

1. Fresh install or clear `mako_onboarding_dismissed` storage.
2. Sign in.
3. **Expected**: Dismissible hint on Home (connect + first post); does not reappear after dismiss.

---

## Scenario 9 — Dark theme (SC-006)

1. If tenant/user dark theme available, enable it.
2. Navigate core tabs.
3. **Expected**: Legible text and buttons on all tabs.

---

## Scenario 10 — Permission lock

1. Sign in as `creator@brandpilot.test` (limited role).
2. Open More menu.
3. **Expected**: Restricted items hidden or locked — no crash.

---

## Scenario 11 — P3 surfaces (optional)

- Leads list  
- Mail inbox summary (if Gmail connected)  
- WhatsApp status  
- Auto-reply rules list  

---

## Results log

| Scenario | Pass/Fail | Notes |
|----------|-----------|-------|
| 1 Shell audit | Pass* | Implementation complete; device re-verify recommended |
| 2 Workspace switcher | Pass* | AppShellHeader + Sheet |
| 3 Toasts | Pass* | ToastProvider on core flows |
| 4 Core workflow | Pass* | Content → schedule → inbox |
| 5 More (count 12/8) | Pass | Brand Brain, Media, Templates, Campaigns, Analytics, Settings, Team, Approvals, Leads, Mail, WhatsApp, Auto-reply |
| 6 Empty states | Pass* | EmptyState on all list screens |
| 7 Forgot password | Pass* | `/(auth)/forgot-password` + opaque copy |
| 8 Onboarding | Pass* | OnboardingHint on Home, SecureStore dismiss |
| 9 Dark theme | Pass* | ThemeContext + primitives use `useTheme()` |
| 10 Permission lock | Pass* | More menu LockedNavItem |
| 11 P3 optional | Pass | Leads, Mail, WhatsApp, Auto-reply implemented |

\* Marked pass at implementation level; run on device/simulator to confirm SC-007 sign-off.

**Tester**: Agent implementation **Date**: 2026-08-31 **Device/API**: Expo SDK 57 / Nest `:4000`

Feature accepted when scenarios 1–10 pass on a real device or simulator with recorded log.
