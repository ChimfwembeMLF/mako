# Phase 0: Outline & Research

## Unknowns & Clarifications

1. **Tour State Storage**: Should completed tour state be saved globally in the database per user, or locally in the browser's localStorage for simplicity?
   - **Decision**: Save globally in the database per user.
   - **Rationale**: User answered this via clarification. Ensures that when a user logs in from a different device, they don't see the same tour again.
   - **Alternatives considered**: Local storage was considered but rejected because it would trigger the tour again on new devices or incognito mode.

2. **Initial Scope**: Which specific pages/flows should have tours configured in this initial implementation?
   - **Decision**: Dashboard and Content Engine.
   - **Rationale**: User answered this via clarification. These are the core engagement pages for the application.

3. **Database Schema Integration**: How do we store this data without creating too much overhead?
   - **Decision**: Add a `preferences` JSONB column to the `users` table.
   - **Rationale**: A JSONB column provides flexibility for future user preferences without requiring schema changes every time. It's natively supported by PostgreSQL, TypeORM, and SeaORM.
   - **Alternatives considered**: A dedicated `user_preferences` table (overkill for just tour state) or a dedicated `tourState` JSONB column (less flexible for future generic preferences).

4. **Nest-Rust Parity**: How do we implement the update endpoint?
   - **Decision**: Expose `PATCH /api/v1/users/me/preferences` in both NestJS and Rust.
   - **Rationale**: Required by Constitution Principle I (Nest-Rust Parity).
