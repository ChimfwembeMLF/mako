# Phase 0: Research & Technical Decisions

## Decision: Native OAuth Deep Linking Implementation
**Decision**: Use `expo-auth-session` configured for native deep-linking (`useProxy: false`) and ensure the custom URL schemes (`com.tekrem.mako`) are registered correctly in `app.json`.
**Rationale**: `expo-auth-session` natively supports triggering the native Google/Meta/etc. apps if the device has them installed, falling back to a web `AuthSession` otherwise. This avoids writing custom native Kotlin/Swift code.
**Alternatives considered**: Writing custom native modules for each social platform SDK (rejected due to excessive complexity and maintenance burden).

## Decision: Theme Configuration Storage & Delivery
**Decision**: Store `ThemeConfiguration` as a JSONB column or related entity on the `Tenant` table in the backend. Expose a `GET /api/v1/tenants/theme` endpoint. The mobile app will fetch this on startup and cache it using React Native's `AsyncStorage` (or Zustand persist).
**Rationale**: Centralizing theming at the Tenant level aligns with the Mako Constitution's multi-tenant design. Caching ensures the app still renders gracefully if opened offline.
**Alternatives considered**: Hardcoding themes in the mobile app build (rejected because admins need to set themes dynamically).

## Decision: Bottom Navigation UI
**Decision**: Refactor `app/(tabs)/_layout.tsx` (assuming `expo-router`) to limit visible tabs to 4-5 items. Move secondary screens into a unified "Menu" or "More" tab or a side drawer. Increase icon padding and size.
**Rationale**: A spacious bottom tab bar is standard UX practice (e.g., Apple Human Interface Guidelines). Too many tabs cause mis-taps.
**Alternatives considered**: Keeping all tabs but making them smaller (rejected due to accessibility and usability concerns).
