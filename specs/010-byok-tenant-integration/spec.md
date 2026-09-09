# Feature Specification: BYOK Tenant Integration

**Feature Branch**: `010-byok-tenant-integration`

**Created**: 2026-09-09

**Status**: Draft

**Input**: User description: "help me implement BYOK in mako or each tenant, how can we make work with our already existing integration"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configure Custom Integration Key (Priority: P1)

As a Tenant Administrator, I want to be able to input my own API key for an integration, so that my usage is billed to my own account rather than the platform's default account.

**Why this priority**: Core functionality for BYOK. If tenants cannot provide their key, the feature doesn't exist.

**Independent Test**: Can be fully tested by saving a custom key in the tenant settings and observing that the next integration call uses the provided key.

**Acceptance Scenarios**:

1. **Given** I am logged in as a Tenant Admin on the settings page, **When** I enter a valid integration key and save, **Then** the key is securely persisted.
2. **Given** I have saved a custom key, **When** I trigger an action that uses the integration, **Then** the system uses my custom key instead of the default system key.

---

### User Story 2 - Integration Fallback & Error Handling (Priority: P2)

As a Tenant Administrator, I want to be notified if my custom key is invalid or exhausted, so that I can update it and restore functionality.

**Why this priority**: Essential for UX. Without it, users will experience silent failures if their key expires.

**Independent Test**: Can be fully tested by providing an invalid key and triggering the integration.

**Acceptance Scenarios**:

1. **Given** I have saved an invalid/exhausted custom key, **When** I trigger the integration, **Then** the system displays a clear error indicating the key is invalid.

---

### Edge Cases

- What happens when a tenant deletes their custom key? (System should revert to the default integration behavior or block usage if no default exists).
- How does system handle concurrent requests when a key is being updated?
- What happens if the integration provider's API structure changes?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow Tenant Administrators to securely store custom API keys for AI Providers (e.g., OpenAI, Gemini, Mistral, etc.).
- **FR-002**: System MUST securely encrypt the tenant's custom key at rest in the database using AES-256 encryption with a master system environment key (`ENCRYPTION_KEY`).
- **FR-003**: System MUST use the tenant-specific key (if available) when calling the integration API on behalf of the tenant.
- **FR-004**: System MUST fallback to the platform's default AI Provider key if a tenant's custom key is invalid or runs out of quota, ensuring the feature never breaks for the user.
- **FR-005**: System MUST allow Tenant Administrators to remove or update their custom key at any time.
- **FR-006**: When the feature touches the live API, System MUST implement the API routes, key encryption/decryption, and integration logic in **BOTH** the NestJS (`api`) and Rust (`api-rust`) runtimes to maintain strict behavioral parity.
- **FR-007**: When the feature stores tenant or workspace data, System MUST enforce tenant/workspace isolation and RBAC.

### Key Entities

- **TenantIntegrationConfig**: Stores the integration configurations and encrypted keys associated with a specific Tenant.
- **IntegrationProvider**: The third-party service being integrated (e.g., OpenAI, Gemini, Mistral).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Tenants can successfully configure and save a custom key in under 2 minutes.
- **SC-002**: 100% of integration requests for a configured tenant use the tenant's custom key instead of the platform key.
- **SC-003**: Custom keys are never exposed in plain text in logs or API responses.

## Assumptions

- We are referring to "Bring Your Own Key" for 3rd-party API integrations, rather than encryption-at-rest keys for database fields.
- The existing integration architecture supports dynamically swapping out the authentication token/key per request.
- The front-end settings page will be extended to include a "BYOK" or "Integrations" section.
