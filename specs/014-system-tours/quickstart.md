# Quickstart Validation

## Prerequisites
- Local development environment running with `npm run dev` in `api/` and `client/`, or `cargo run` in `api-rust/`.
- A valid test user account.

## Validation Scenarios

### Scenario 1: New User Dashboard Tour
1. Log into the web application as a new user.
2. Navigate to the Dashboard (`/`).
3. **Expected**: The Driver.js tour automatically starts, highlighting the main navigation elements.
4. Click through to complete the tour.
5. Reload the Dashboard page.
6. **Expected**: The tour does **not** start automatically again.

### Scenario 2: Content Engine Feature Tour
1. Navigate to the Content Engine page (`/content-engine`).
2. **Expected**: A specific tour for the Content Engine starts automatically.
3. Click "Skip" on the tour.
4. Reload the page.
5. **Expected**: The tour does **not** start automatically again.

### Scenario 3: Manual Tour Restart
1. Navigate to a page where a tour was previously completed or skipped.
2. Click the "Help" or "Tour" icon in the navigation bar or page header.
3. **Expected**: The tour for the current page restarts manually.

### Scenario 4: Nest-Rust Parity Check
1. Start the Rust API backend (`cd api-rust && cargo run`).
2. Complete a tour in the UI.
3. **Expected**: The network request `PATCH /api/v1/users/me/preferences` returns `200 OK`.
4. Switch to the NestJS API backend (`cd api && npm run start:dev`).
5. Open an Incognito window and log in with a new user.
6. Complete a tour.
7. **Expected**: The network request `PATCH /api/v1/users/me/preferences` returns `200 OK`.
