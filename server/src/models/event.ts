import { RecurringEventEntity } from "./recurring-event";
import { PoolClient } from "pg";
import pgformat from "pg-format";

interface EventEntity {
  googleId: string;
  recurringEventGoogleId: string;
  startDateTime: Date;
  endDateTime: Date;
  timeZone: string;
  summary: string;
  tracked: boolean;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function convertDBRowToEntity(row: any): EventEntity {
  return {
    googleId: row.google_id,
    recurringEventGoogleId: row.recurring_event_google_id,
    startDateTime: new Date(row.start_date_time),
    endDateTime: new Date(row.end_date_time),
    timeZone: row.time_zone,
    summary: row.summary,
    tracked: row.tracked,
  };
}

export async function deleteByRecurringEvents(
  poolClient: PoolClient,
  recurringEvents: RecurringEventEntity[]
): Promise<void> {
  await poolClient.query(
    pgformat(
      `DELETE
       FROM events
       WHERE recurring_event_google_id IN (%L)`,
      recurringEvents.map((re) => re.googleId)
    )
  );
}

export async function findAllInstancesByOrganizer(
  poolClient: PoolClient,
  googleUserId: string
): Promise<EventEntity[]> {
  const res = await poolClient.query(
    `SELECT events.*, recurring_events.tracked
     FROM events
     INNER JOIN recurring_events ON(events.recurring_event_google_id = recurring_events.google_id)
     WHERE organizer_google_id = $1`,
    [googleUserId]
  );
  return res.rows.map(convertDBRowToEntity);
}
