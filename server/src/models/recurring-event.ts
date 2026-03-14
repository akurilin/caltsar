import { PoolClient } from "pg";
import pgformat from "pg-format";
import { calendar_v3 } from "@googleapis/calendar";

export interface RecurringEvent {
  googleId: string;
  summary: string;
  tracked: boolean;
  organizerGoogleId: string;
}

export interface RecurringEventEntity {
  googleId: string;
  summary: string;
  tracked: boolean;
  createdAt: Date;
  organizerGoogleId: string;
}

export function convertGoogleEventsToRecurringEvents(
  events: calendar_v3.Schema$Event[],
  organizerGoogleId: string
): RecurringEvent[] {
  return events.map((e) => {
    return {
      googleId: e.id ? e.id : "PLACEHOLDER",
      summary: e.summary ? e.summary : "PLACEHOLDER",
      tracked: false,
      organizerGoogleId: organizerGoogleId,
    };
  });
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function convertDBRowToEntity(row: any): RecurringEventEntity {
  return {
    googleId: row.google_id,
    summary: row.summary,
    tracked: row.tracked,
    createdAt: new Date(row.created_at),
    organizerGoogleId: row.organizer_google_id,
  };
}

export async function findByOrganizer(
  poolClient: PoolClient,
  organizerGoogleId: string
): Promise<RecurringEventEntity[]> {
  const res = await poolClient.query(
    `SELECT *
     FROM recurring_events
     WHERE organizer_google_id = $1`,
    [organizerGoogleId]
  );

  const events = res.rows.map((e) => convertDBRowToEntity(e));
  return events;
}

export async function deleteByOrganizer(
  poolClient: PoolClient,
  organizerGoogleId: string
): Promise<void> {
  await poolClient.query(
    `DELETE
     FROM recurring_events
     WHERE organizer_google_id = $1`,
    [organizerGoogleId]
  );
}

// intentionally not making it RETURNING * for now to reduce the load
export async function insertRecurringEvents(
  poolClient: PoolClient,
  recurringEvents: RecurringEvent[]
): Promise<void> {
  const insertRecurringEventsQuery = pgformat(
    `INSERT INTO recurring_events (google_id, summary, tracked, organizer_google_id)
     VALUES %L
     ON CONFLICT (google_id) DO UPDATE SET summary = EXCLUDED.summary`,
    recurringEvents.map((e) => [
      e.googleId,
      e.summary,
      false,
      e.organizerGoogleId,
    ])
  );
  await poolClient.query(insertRecurringEventsQuery);
}
