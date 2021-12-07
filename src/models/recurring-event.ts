import { PoolClient } from "pg";

export interface RecurringEventEntity {
  googleId: string;
  summary: string;
  tracked: boolean;
  createdAt: Date;
  organizerGoogleId: string;
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
