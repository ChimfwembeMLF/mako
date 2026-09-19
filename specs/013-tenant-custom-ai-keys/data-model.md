# Data Model Updates

## Existing Entities
- `TenantIntegrationConfig`: Already contains fields for `tenant_id`, `provider`, `encrypted_api_key`, `iv`, `auth_tag`. Supports multiple providers per tenant.
- `Tenants`: Contains core tenant data.

## New/Modified Entities
- **TenantPreferences (or similar settings structure)**: We need a way to store the "Preferred AI Provider" (e.g., `preferredAiProvider: IntegrationProvider`). This might be a new column on the `Tenants` table, or part of a JSON settings column if one exists.
  - *Implementation choice*: Add a nullable `preferred_ai_provider` string column to the `tenants` table (with an enum constraint in application logic matching `IntegrationProvider`).

## Validation Rules
- When a tenant selects a `preferred_ai_provider`, the system must ensure a valid `TenantIntegrationConfig` exists for that provider before allowing the selection to be saved.
