# Phase 1: Data Model

As a mobile client application, the app does not define backend database schemas. However, it defines client-side state models and interfaces that mirror the API responses.

## Core Entities

### 1. UserSession
Stores the authentication state of the user securely on the device.

**Fields**:
- `accessToken` (string): The JWT or session token.
- `refreshToken` (string | null): Token used to refresh the session.
- `userId` (string): UUID of the authenticated user.
- `expiresAt` (number): Timestamp of token expiration.

**Storage Location**: `expo-secure-store`

### 2. UserProfile
The authenticated user's details displayed in the app.

**Fields**:
- `id` (string): UUID
- `email` (string): User's email address
- `firstName` (string)
- `lastName` (string)
- `avatarUrl` (string | null)

### 3. WorkspaceContext
The active workspace the user is currently interacting with.

**Fields**:
- `id` (string): UUID
- `name` (string): Display name of the workspace
- `role` (string): User's RBAC role in this workspace (e.g., 'admin', 'member')
