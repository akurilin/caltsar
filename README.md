# CalTsar (Calentsar)

> **Archived — December 2021.** This project is no longer actively developed or maintained.

CalTsar is a meeting accountability tool for Google Calendar. It syncs with your Google Calendar, identifies recurring events you organize, and lets you opt in to tracking them. The idea was that tracked events would trigger feedback surveys sent to attendees at the end of each meeting, giving organizers longitudinal insight into how their recurring meetings are going.

## How it works

1. Sign in with Google OAuth and grant read access to your calendar events
2. CalTsar syncs your recurring events where you are the organizer
3. Browse your events on a calendar view and toggle tracking on/off for individual recurring events
4. Tracked events send feedback surveys to attendees after each instance
5. Review aggregate and per-instance feedback over time

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
