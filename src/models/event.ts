import { RecurringEventEntity } from "./recurring-event";
import { PoolClient } from "pg";
import pgformat from "pg-format";

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
