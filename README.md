# CalTsar (Calentsar)

> **Archived — December 2021.** This project is no longer actively developed or maintained.

CalTsar is a meeting accountability tool for Google Calendar. It was built to address a common problem in organizations: recurring meetings tend to accumulate over time, and there's rarely a structured way to evaluate whether they're still useful. Standup that nobody pays attention to, the weekly sync that could be an email, the retro that lost its spark three months ago — these meetings persist because nobody has the data to make a case for changing or cancelling them.

CalTsar gives meeting organizers visibility into their recurring meetings by syncing with Google Calendar and letting them opt in to tracking specific events. The vision was that tracked meetings would automatically survey attendees after each occurrence, building up longitudinal feedback data that organizers could use to identify which meetings are working and which need to be rethought.

## What you can do with CalTsar

**See all your recurring meetings in one place.** After signing in with Google, CalTsar syncs your primary calendar and pulls out every recurring event where you are the organizer. These are displayed on an interactive calendar view spanning the current and next month, as well as a sortable table view with event details (summary, start/end times, timezone).

**Stay in sync automatically.** CalTsar registers a webhook with Google Calendar so that any changes you make to your calendar (new recurring events, cancellations, time changes) are automatically reflected without needing to manually re-sync. If the webhook expires, the next time you open the app it re-syncs from scratch.

**Choose which meetings to track.** Not every recurring meeting needs scrutiny. From the calendar view, you can click on any recurring event to toggle tracking on or off. Tracking is per-recurring-event — toggling it once applies to all future instances of that event. The events table also shows tracking status at a glance.

**Account management.** You can delete your account and all associated data (events, tracking preferences, notification channels) at any time.

### Intended but unfinished functionality

CalTsar was archived at the MVP stage. The following features were planned but not fully implemented:

- **Attendee feedback surveys** — The core value proposition. Tracked events were meant to trigger short feedback surveys sent to attendees at the conclusion of each meeting instance. The tracking infrastructure is in place, but the survey delivery and collection mechanism was not built.
- **Feedback dashboards** — Aggregate and per-instance feedback views so organizers could see trends over time (e.g., a meeting's perceived usefulness declining over weeks).
- **Non-primary calendar support** — Only the user's primary Google Calendar is synced.
- **Non-organizer tracking** — Only events where the authenticated user is the organizer can be tracked.

## Architecture

Monorepo with two packages:

- **`server/`** — Express + TypeScript API backend
- **`client/`** — React + TypeScript frontend (Create React App)

### Server

The backend is an Express server written in TypeScript, deployed to Heroku. It handles:

- **Authentication** — Google OAuth 2.0 via Passport.js, with both a `google` strategy for real logins and a `custom` strategy for test/dev. Sessions are stored in Postgres via `connect-pg-simple` with a 30-day cookie TTL. The OAuth flow requests offline access so the server can act on behalf of users even when they're not in the app.
- **Calendar sync** — On login (and on push notification), the server calls the Google Calendar API to fetch all recurring events and their instances for a two-month window. It paginates through results, filters to events where the user is the organizer, then upserts recurring events and their instances into Postgres. Cancelled recurring events are cleaned up. The sync runs inside a database transaction.
- **Push notifications** — After each sync, the server registers a webhook with Google's `events.watch()` API so that calendar changes trigger an automatic re-sync. Channels have a 30-minute TTL and are reset on each manual sync. Incoming notifications are matched to users by channel/resource ID. The webhook endpoint (`POST /notifications`) is unauthenticated since it's called directly by Google.
- **Tracking** — Users can toggle tracking on/off for individual recurring events they organize (`POST/DELETE /trackings/:recurringEventId`). This updates a `tracked` boolean on the `recurring_events` table. The intent was for tracked events to trigger feedback surveys to attendees.
- **Google API client management** — OAuth2 clients are cached in an in-memory map keyed by user ID. Each client registers a `tokens` event handler that persists refreshed access/refresh tokens back to the database, so token rotation is handled transparently.
- **Middleware** — Request-scoped injection of the Postgres pool and per-user Google API client via Express middleware, plus an auth guard (`ensureUserIsLoggedIn`) that returns 401 for unauthenticated requests.

#### API routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/auth/google` | No | Initiates Google OAuth flow |
| GET | `/auth/google/callback` | No | OAuth callback, redirects to frontend |
| GET | `/auth/logout` | Yes | Destroys session and clears cookie |
| GET | `/auth/testlogin` | No | Dev-only login as test user |
| GET | `/users/me` | Yes | Returns current user |
| DELETE | `/users/me` | Yes | Deletes current user and their data |
| GET | `/events` | Yes | Lists all event instances for the user's recurring events |
| POST | `/trackings/:id` | Yes | Start tracking a recurring event |
| DELETE | `/trackings/:id` | Yes | Stop tracking a recurring event |
| POST | `/sync` | Yes | Full calendar sync + notification reset |
| POST | `/notifications` | No | Google push notification webhook |

### Client

The frontend is a React 17 class/function component app using Ant Design for UI. It communicates with the server via Axios with `withCredentials: true` for cookie-based auth. The API base URL is configured via `REACT_APP_*` environment variables.

Key views:

- **Home** — Landing page with Google Login button. Redirects authenticated users to the sync flow.
- **Sync** — Triggers a `POST /sync` on mount, shows a spinner, then redirects to the calendar view.
- **Calendar** — Ant Design `Calendar` component rendering a two-month view. Each day cell shows recurring event instances. Clicking an event toggles tracking on/off with immediate API calls and optimistic UI updates.
- **Events** — Table view of all recurring event instances with summary, times, timezone, and tracking status.
- **Help** — Static FAQ page explaining how CalTsar works.

End-to-end tests use Cypress, running against a real backend with a seeded test database.

### Data layer

PostgreSQL with schema migrations managed by Liquibase (changelog in `server/sql/`). Tables:

- **`users`** — Google profile info, OAuth tokens (access + refresh), push notification channel/resource IDs, watching expiry
- **`recurring_events`** — Google event ID, summary, organizer reference, tracked flag
- **`events`** — Individual instances of recurring events with start/end times and timezone, foreign-keyed to `recurring_events`
- **`sessions`** — Express session store (managed by `connect-pg-simple`)

The sync process does a full delete-and-reinsert of event instances within the time window, while recurring events are upserted (preserving the `tracked` flag via `ON CONFLICT ... DO UPDATE`).

### Key integrations

- **Google OAuth 2.0** — Authentication with offline access for background calendar sync. Passport.js handles the flow; tokens are persisted to Postgres and automatically refreshed via the Google Auth Library's token event system.
- **Google Calendar API** — `events.list` for fetching recurring events and instances, `events.watch` for push notification registration, `channels.stop` for cleanup. All calls go through per-user OAuth2 clients with automatic token refresh.

## Project structure

```
├── server/          # Express API
│   ├── src/         # TypeScript source (handlers, models, routes, middleware)
│   ├── scripts/     # DB migration, seeding, and maintenance shell scripts
│   └── sql/         # Liquibase changelog and seed data
├── client/          # React frontend
│   ├── src/         # Components, API config, models
│   ├── public/      # Static assets
│   └── cypress/     # End-to-end tests
└── .github/         # CI workflows (build/test for both packages, Cypress e2e)
```
