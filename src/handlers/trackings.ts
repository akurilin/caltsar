import { Request, Response, NextFunction } from "express";
import { calendar_v3 } from "@googleapis/calendar";
import { UserEntity } from "../models/user";
import { v4 as uuidv4 } from "uuid";
import { GaxiosError } from "gaxios";

// async function upsertInstances(
//   poolClient: PoolClient,
//   instances: calendar_v3.Schema$Event[]
// ) {
//   const values = instances
//     .filter((item) => item.status != "cancelled")
//     .map((item) => {
//       if (!item.end || !item.end.dateTime || !item.end.timeZone) {
//         throw new Error("The event is missing end time properties");
//       }
//       return [
//         item.id,
//         item.recurringEventId,
//         new Date(item.end.dateTime),
//         item.end.timeZone,
//       ];
//     });

//   // console.log(`Upserting event instances:`);
//   // values.forEach((v) => console.log(v));

//   const insertEventsQuery = pgformat(
//     "INSERT INTO events (google_id, recurring_event_google_id, end_date_time, time_zone) VALUES %L ON CONFLICT (google_id) DO UPDATE SET end_date_time = EXCLUDED.end_date_time, time_zone = EXCLUDED.time_zone",
//     values
//   );
//   await poolClient.query(insertEventsQuery);
// }

// NB: this is likely the wrong response if the user has already some
//     data associated here unless they explicitly want to delete all of the
//     data and don't care about preserving history
// function deleteRecurring(
//   poolClient: PoolClient,
//   instances: calendar_v3.Schema$Event[]
// ) {
//   const cancelledGoogleIds = instances.map((item) => item.id);
//   // console.log(`DELETE-ing all recurring_events with ids:`);
//   // console.log(cancelledGoogleIds);
//   if (cancelledGoogleIds.length > 0) {
//     const deleteQuery = pgformat(
//       "DELETE FROM recurring_events WHERE google_id in (%L)",
//       cancelledGoogleIds
//     );
//     return poolClient.query(deleteQuery);
//   } else {
//     return Promise.resolve(0);
//   }
// }

// function deleteInstances(
//   poolClient: PoolClient,
//   instances: calendar_v3.Schema$Event[]
// ) {
//   const cancelledGoogleIds = instances.map((item) => item.id);
//   // console.log(`DELETE-ing all events instances with ids:`);
//   // console.log(cancelledGoogleIds);
//   if (cancelledGoogleIds.length > 0) {
//     const deleteQuery = pgformat(
//       "DELETE FROM events WHERE google_id in (%L)",
//       cancelledGoogleIds
//     );
//     return poolClient.query(deleteQuery);
//   } else {
//     return Promise.resolve(0);
//   }
// }

export async function handlePost(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const user = req.user as UserEntity;
  const pool = req.pool;
  const poolClient = await pool.connect();
  const recurringEventId = req.params.recurringEventId;

  try {
    // this call is mostly only needed to get an authoritative summary name
    // assuming we can't trust instances to be representative of the true title
    // const getResult = await calendarAPI.events.get({
    //   calendarId: "primary",
    //   eventId: recurringEventId,
    //   maxAttendees: 1,
    // });
    // const event: calendar_v3.Schema$Event = getResult.data;

    const queryRes = await poolClient.query(
      `SELECT *
         FROM recurring_events
         WHERE google_id = $1 AND organizer_google_id = $2`,
      [recurringEventId, user.googleId]
    );
    const recEvent = queryRes.rows[0];

    // Handle all the common error cases
    if (!recEvent) {
      res.status(400).json({ message: "No such event found" });
      // } else if (event.status === "cancelled") {
      //   res.status(400).json({ message: "You cannot track a cancelled event" });
    } else {
      await poolClient.query("BEGIN");

      await poolClient.query(
        `UPDATE recurring_events
         SET tracked = true
         WHERE google_id = $1 AND organizer_google_id = $2`,
        [recurringEventId, user.googleId]
      );

      await poolClient.query("COMMIT");
      res.status(200).json({
        message: "Tracking initiated successfully",
      });
    }
  } catch (e) {
    await poolClient.query("ROLLBACK");
    next(e);
  } finally {
    poolClient.release();
  }
}

export async function handleDelete(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const pool = req.pool;
  const poolClient = await pool.connect();
  const user = req.user as UserEntity;
  const recurringEventId = req.params.recurringEventId;
  try {
    await poolClient.query("BEGIN");

    // this doesn't throw a 400 when unauthorized, it succeeds silently which
    // maybe somewhat unintuitive all things considered
    await poolClient.query(
      `UPDATE recurring_events
       SET tracked = false
       WHERE google_id = $1 AND organizer_google_id = $2`,
      [recurringEventId, user.googleId]
    );

    // could be optimized with just a count
    const trackedRecurringEventsQuery = await poolClient.query(
      `SELECT *
       FROM recurring_events
       WHERE organizer_google_id = $1 AND tracked = true`,
      [user.googleId]
    );

    await poolClient.query("COMMIT");
    res.status(200).json({ message: "Tracking stopped" });
  } catch (e) {
    await poolClient.query("ROLLBACK");
    next(e);
  } finally {
    poolClient.release();
  }
}
