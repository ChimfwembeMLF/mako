# Feature Specification: System Admin Keys

**Feature Branch**: `[012-system-admin-keys]`

**Created**: 2026-09-14

**Status**: Draft

**Input**: User description: "i want to be able to add all the keys as system admin in the app not just using the env the env should be the back up"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configure System API Keys (Priority: P1)

System Administrators need to configure global API keys (e.g., OpenAI, Google Drive, Stripe) directly from the admin dashboard so they don't have to restart the server or redeploy to update credentials.

**Why this priority**: Core request by the user to move away from strictly .env-based configuration.

**Independent Test**: Can be fully tested by logging in as a Super Admin, navigating to System Settings, and saving a new API key for a specific provider.

**Acceptance Scenarios**:

1. **Given** a user is logged in as a Super Admin, **When** they navigate to the System Settings page, **Then** they see a new "Platform Integrations" tab where they can input API keys for supported providers.
2. **Given** a Super Admin enters a key and saves, **When** they submit the form, **Then** the key is encrypted and stored securely in the database.
3. **Given** a non-admin user attempts to access the System Settings, **When** they navigate to the URL, **Then** they are blocked by a permission gate.

---

### User Story 2 - Application Fallback to Environment Variables (Priority: P1)

The application services need to read credentials from the database first, and if not present, fall back to the environment variables (.env) so that the system remains backward compatible and functional during transitions.

**Why this priority**: Essential to satisfy the requirement that ".env should be the back up".

**Independent Test**: Can be fully tested by removing a database key for a provider and observing that the service gracefully falls back to the .env key, and vice versa.

**Acceptance Scenarios**:

1. **Given** a service requires an API key, **When** it fetches configuration, **Then** it first checks the `system_settings` database table.
2. **Given** the database does not contain the key, **When** the service fetches configuration, **Then** it reads from `process.env`.
3. **Given** the database contains the key, **When** the service fetches configuration, **Then** it uses the database key and ignores `process.env`.

### Edge Cases

- What happens if a database key is corrupted or fails to decrypt? (Fallback to env or throw an error?)
- How are new integration providers added to the UI? Is it hardcoded or dynamic?
- Does changing a key require a service restart? (It shouldn't, settings should be fetched on-demand or cached with a short TTL).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a UI in `SystemSettingsPage` for Super Admins to manage global integration keys (e.g., Mistral, OpenAI, Gemini, DeepSeek, Google Auth, etc.).
- **FR-002**: System MUST store global API keys securely in the database, encrypting them at rest using the existing `EncryptionService`.
- **FR-003**: System services (AI, Storage, Auth) MUST be refactored to fetch their credentials using a priority system: 1. Database (`system_settings`), 2. Environment Variables (`process.env`).
- **FR-004**: System MUST NOT expose raw API keys in API responses; they should be masked or hidden when returned to the frontend.
- **FR-005**: The fallback mechanism MUST be implemented consistently across both NestJS (`api/`) and Rust (`api-rust/`) runtimes.
- **FR-006**: When the feature touches the live API, System MUST implement the behavior in **BOTH** the NestJS (`api/`) and Rust (`api-rust/`) runtimes unless the spec explicitly scopes it.
- **FR-007**: When the feature stores tenant or workspace data, System MUST enforce tenant/workspace isolation and RBAC. (Note: These are system-level keys, so they are not tenant-scoped, but require Super Admin RBAC).

### Key Entities

- **SystemSettings**: Existing table (`system_settings`) used to store the encrypted keys, likely under a specific key like `platform_integrations`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Super Admins can update integration keys in under 1 minute via the UI without requiring a server restart.
- **SC-002**: Application services successfully resolve credentials 100% of the time if either the DB or the .env has the correct key.
- **SC-003**: Zero plain-text API keys are visible in the database or network responses.

## Assumptions

- We will leverage the existing `system_settings` table and `SystemSettingsService` to store the keys.
- We will reuse the existing `EncryptionService` to encrypt the keys before saving them to `system_settings`.
- Platform integrations refers to all major 3rd-party services currently configured via `.env` (AI providers, S3/Supabase, Google Auth, Meta).
