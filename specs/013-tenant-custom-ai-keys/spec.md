# Feature Specification: Tenant Custom AI Keys & Usage Bypass

**Feature Branch**: `[013-tenant-custom-ai-keys]`

**Created**: 2026-09-18

**Status**: Draft

**Input**: User description: "yes, also use the keys added in the platform integrations not the env, only default to .env if those keys are not set in the db, then also review how the system can switch to the clients ai keys, also allow tenants to set the ai to use, what happens if a tenant provided all the ai keys which ine should the system use, and once i=a tenant adds there one keys there ai usage should not be limited byt their subscribed plan"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configure Custom AI Keys (Priority: P1)

As a tenant administrator, I want to configure my own API keys for various AI providers (OpenAI, Mistral, Gemini) and select a preferred provider, so that my workspace can use my own accounts for AI generation tasks.

**Why this priority**: Core capability enabling tenants to bring their own keys (BYOK).

**Independent Test**: Can be fully tested by entering API keys in the integration settings UI and setting a preferred provider, which saves to the database successfully.

**Acceptance Scenarios**:

1. **Given** a tenant admin is on the Integration Settings page, **When** they add valid API keys for Mistral and OpenAI and set OpenAI as preferred, **Then** the configuration is saved securely to the database.

---

### User Story 2 - System Routes to Custom AI Keys (Priority: P1)

As a user generating AI content, I want the system to utilize my tenant's preferred AI provider and custom API keys instead of the platform's global keys, so that I don't encounter platform-level rate limits (e.g., HTTP 429).

**Why this priority**: Without proper routing, the custom keys are useless and the rate limiting bug persists.

**Independent Test**: Can be fully tested by generating AI content in a workspace with custom keys configured, verifying via network/backend logs that the request was routed to the correct provider using the custom key.

**Acceptance Scenarios**:

1. **Given** a tenant with a preferred provider of OpenAI and a valid custom key, **When** a user generates platform content, **Then** the request is sent to the OpenAI API using the tenant's key.
2. **Given** a tenant with no custom AI keys, **When** a user generates content, **Then** the system falls back to the platform's default provider and global `.env` keys.

---

### User Story 3 - Bypass Subscription AI Limits (Priority: P2)

As a tenant using my own API keys, I want my AI usage to be exempt from my subscription plan's AI usage limits, so that I can generate as much content as I want while paying the AI provider directly.

**Why this priority**: Unlocks unrestricted usage for enterprise/BYOK tenants.

**Independent Test**: Can be fully tested by exceeding the normal plan limits with custom keys configured, ensuring generation still succeeds.

**Acceptance Scenarios**:

1. **Given** a tenant has exceeded their monthly AI usage limit but is using their own API key, **When** they attempt to generate AI content, **Then** the system allows the generation to proceed.
2. **Given** a tenant has exceeded their monthly AI usage limit and is using the platform's global keys, **When** they attempt to generate AI content, **Then** the system blocks the generation and prompts an upgrade.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support querying and retrieving custom AI API keys from the `TenantIntegrationConfig` database table before falling back to global `.env` configurations.
- **FR-002**: System MUST allow tenants to specify a "Preferred AI Provider" in their integration settings. If multiple valid keys are provided, the system MUST use this preferred provider for all generic AI generation tasks.
- **FR-003**: System MUST provide an abstraction (e.g., an AI Router) that dynamically selects the correct provider implementation (Mistral, OpenAI, Gemini, etc.) based on the tenant's preferred provider configuration.
- **FR-004**: System MUST ensure that the `tenantId` is passed contextually to all AI operations (e.g., via parameter passing) to allow custom key lookups across all AI features.
- **FR-005**: System MUST bypass the standard AI usage quota checks (`assertWithinLimit`) when the tenant is authenticated and executing the request using their own custom API key.
- **FR-006**: System MUST track and log AI usage (tokens) for analytics purposes, regardless of whether a custom key or global key was used, but MUST flag the usage to distinguish it for billing/quota purposes.
- **FR-007**: When the feature touches the live API, System MUST implement the behavior in **BOTH** the NestJS (`api/`) and Rust (`api-rust/`) runtimes unless the spec explicitly scopes it.
- **FR-008**: When the feature stores tenant or workspace data, System MUST enforce tenant/workspace isolation and RBAC.

### Key Entities 

- **TenantIntegrationConfig**: Stores encrypted API keys for various providers (OpenAI, Mistral, etc.).
- **TenantPreferences/Settings**: Requires a new field or mechanism to store the "Preferred AI Provider".
- **AiUsageTracker**: Records token consumption and asserts limits based on plan and key ownership.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of AI generation requests from tenants with custom keys and a preferred provider are routed to their designated provider using their key.
- **SC-002**: Tenants using their own API keys can successfully bypass their plan's usage limits with a 100% success rate.
- **SC-003**: No regressions in AI functionality for tenants relying on the default platform `.env` keys.

## Assumptions

- Users have basic technical knowledge to securely retrieve and input their own API keys.
- The UI for managing integration settings exists but may need minor additions to support selecting a "Preferred AI Provider".
- All supported AI providers have functionally equivalent capabilities for text and image adaptation required by the Content Engine.
