# Phase 1: Data Model

## Frontend Interfaces

```typescript
// Core driver.js type imports
import { DriveStep, Config } from 'driver.js';

export interface TourConfig {
  id: string; // e.g., 'dashboard', 'content-engine', 'lead-agent'
  steps: DriveStep[];
  driverConfig?: Partial<Config>;
}

export interface UserPreferences {
  // Existing fields...
  tours?: Record<string, TourCompletionState>;
}

export interface TourCompletionState {
  completed: boolean;
  completedAt: string; // ISO String
}
```

## Backend Data Model

There are no new backend tables required.
We rely on the existing `users` table:

- **Entity**: `User`
- **Field**: `preferences` (Type: `jsonb`, nullable: `true`)
- **API**: `PATCH /api/v1/users/me/preferences` accepts `Record<string, any>` and deeply merges or overwrites the `preferences` jsonb.
