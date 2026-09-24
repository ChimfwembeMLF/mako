# Phase 0: Outline & Research

## Research Areas

### 1. Dynamic Element Wait Strategy for `driver.js`
**Decision**: We will implement a custom `waitForElement` utility function that will be called in `onHighlightStarted`. This utility will use a `MutationObserver` (or simple polling via `requestAnimationFrame` / `setTimeout`) to wait for a maximum of 3000ms for an element to appear in the DOM. If the element does not appear, the tour gracefully skips the step or stops. 
**Rationale**: `driver.js` does not natively wait for elements if they are deeply dynamic (e.g. relying on a slow API call before rendering). By explicitly awaiting the element before calling `tourDriver.moveNext()` or during `onHighlightStarted`, we can guarantee the element exists before the highlight box tries to draw.
**Alternatives considered**: Passing a global boolean `isReady` state to the tour service, which is too highly coupled and pollutes component state.

### 2. Decentralized Configuration Architecture
**Decision**: Each section (Dashboard, Content Engine, etc.) will define a `[Component].tour.ts` file containing a `TourConfig` object.
When a component mounts, it can optionally `useEffect` to call `TourService.autoStartTour(ComponentTourConfig)` which checks `usersApi.preferences` to see if the tour has been seen. For micro-tours (modals, sheets), we will just use a "Tour" button that calls `TourService.startTour(ComponentTourConfig)`.
**Rationale**: Keeps tour definitions co-located with their corresponding components, making it easier to update selectors when the UI changes.
**Alternatives considered**: A massive centralized `tours.config.ts`, which would become unmaintainable as the application scales.

### 3. Tour State Persistence
**Decision**: The `preferences` JSONB column on the `users` table already exists and the frontend API `updatePreferences` is wired to `PATCH /api/v1/users/me/preferences`. The `TourService` already implements the `markTourCompleted` logic. We will ensure this is properly tied to all auto-started tours.
**Rationale**: Native, zero-setup way to maintain cross-device state without adding a new database table.
