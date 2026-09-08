# Data Model: Theme Configuration

## Entity: `Tenant` (Updates)

We will extend the existing `Tenant` entity (or create a related `TenantTheme` entity) to store the styling configuration.

### Fields

| Field Name | Type | Constraints | Description |
|------------|------|-------------|-------------|
| `themePrimaryColor` | `String` | Optional, Valid Hex (e.g. `#FFFFFF`) | The primary brand color for the tenant |
| `themeSecondaryColor`| `String` | Optional, Valid Hex | The secondary brand color |
| `themeLogoUrl` | `String` | Optional, Valid URL | URL to the tenant's logo |
| `themeRadius` | `Number` | Optional | Global border-radius preference for UI elements |

### Relationships

- One `Tenant` has One `ThemeConfiguration` (or it is embedded directly in the `Tenant` table).

### Validation Rules

- Colors must be validated as proper hex codes (`^#[0-9A-Fa-f]{6}$`).
- Logo URL must be a valid HTTP/HTTPS URL.
