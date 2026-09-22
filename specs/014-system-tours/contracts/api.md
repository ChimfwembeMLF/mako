# API Contracts

## `PATCH /api/v1/users/me/preferences`

Updates the authenticated user's preferences. This endpoint must be implemented in both NestJS (`api/`) and Rust (`api-rust/`) to maintain parity.

### Request Body

```json
{
  "tours": {
    "dashboard": {
      "completed": true,
      "completedAt": "2026-09-22T06:37:44Z"
    }
  }
}
```

The payload should be a partial `UserPreferences` object. The backend MUST perform a deep merge of the provided JSON with the existing `preferences` column so that unrelated preferences are not overwritten.

### Response

- `200 OK`: Returns the updated user entity (or the updated preferences object).
- `401 Unauthorized`: If the user is not authenticated.
