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

- **`server/`** — Express + TypeScript API backend. Handles Google OAuth, calendar sync via the Google Calendar API, session management (Postgres-backed), and event/tracking CRUD. Deployed to Heroku.
- **`client/`** — React + TypeScript frontend built with Create React App and Ant Design. Provides calendar view, event list, sync flow, and help pages. Communicates with the server via REST + session cookies.

### Data layer

- PostgreSQL with schema migrations managed by Liquibase
- Sessions stored in Postgres via `connect-pg-simple`
- Google API clients are cached per-user for reuse across requests

### Key integrations

- **Google OAuth 2.0** for authentication (with offline access for background calendar sync)
- **Google Calendar API** for reading recurring events and receiving push notifications

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
