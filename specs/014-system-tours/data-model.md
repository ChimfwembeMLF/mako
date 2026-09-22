# Phase 1: Data Model

## `users` Table Updates

We will add a new JSONB column to the existing `users` table to track arbitrary user preferences, including the completion status of system tours.

### Fields

- `preferences`: `JSONB` (Nullable, Default: `{}`)
  - **Structure**:
    ```typescript
    type UserPreferences = {
      tours: {
        [tourId: string]: {
          completed: boolean;
          completedAt?: string; // ISO DateTime
          dismissed?: boolean;
        }
      }
      // Future preferences can be added here
    }
    ```

### Relationships

- None added. Modifies the existing `User` entity.

### NestJS Entity Update (`UserEntity`)
- Add `@Column({ type: 'jsonb', default: {} }) preferences?: Record<string, any>;`

### Rust Entity Update (`Model`)
- Add `pub preferences: Option<sea_orm::prelude::Json>;`

### Validation Rules
- The preferences object should be a valid JSON object.
- The `PATCH` endpoint should accept a partial preferences object and perform a deep merge to avoid overwriting unrelated preferences.
