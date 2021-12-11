import { Request, Response, NextFunction } from "express";
import { calendar_v3 } from "@googleapis/calendar";
import { UserEntity } from "../models/user";
import { v4 as uuidv4 } from "uuid";
import { GaxiosError } from "gaxios";
import { runSync } from "../models/sync";

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
  const googleClient = req.googleClient;
  const recurringEventId = req.params.recurringEventId;
  const calendarAPI: calendar_v3.Calendar = new calendar_v3.Calendar({
    auth: googleClient,
  });

  try {
    // this call is mostly only needed to get an authoritative summary name
    // assuming we can't trust instances to be representative of the true title
    const getResult = await calendarAPI.events.get({
      calendarId: "primary",
      eventId: recurringEventId,
      maxAttendees: 1,
    });
    const event: calendar_v3.Schema$Event = getResult.data;

    // Handle all the common error cases
    if (event.organizer && event.organizer.email != user.email) {
      res
        .status(400)
        .json({ message: "Only the organizer can track a recurring event" });
    } else if (event.status === "cancelled") {
      res.status(400).json({ message: "You cannot track a cancelled event" });
    } else {
      await poolClient.query("BEGIN");

      await poolClient.query(
        `UPDATE recurring_events
         SET tracked = true
         WHERE google_id = $1 AND organizer_google_id = $2`,
        [recurringEventId, user.googleId]
      );

      // either we didn't have push notifications enabled for this user or the
      // push notification expired and the channel needs to be recreated
      if (
        (!user.pushNotificationChannelId && !user.pushNotificationResourceId) ||
        (user.watchingUntil && user.watchingUntil < new Date())
      ) {
        const ttlInSeconds = 1800;
        const now = new Date();

        // calculate when the push notification will expire so we can renew it
        const newWatchingUntil = new Date(now.getTime() + 1000 * ttlInSeconds);

        // We end up with a unique UUID per user (techically per primary
        // calendar), but we will be sharing the same resource id for the
        // calendar, which is always going to be "primary" in our case
        const channelId = uuidv4();
        const watchRes = await calendarAPI.events.watch({
          calendarId: "primary",
          requestBody: {
            id: channelId,
            type: "web_hook",
            // set it to 1426325213000 once we're certain we don't need channels
            // to expire quicky for debugging purposes
            params: { ttl: ttlInSeconds.toString() },
            address: "https://app.akurilin.com/notifications",
          },
        });

        if (watchRes.status != 200) {
          // we want to force a rollback here by ending up in the catch block
          console.log("RESULT OF WATCH API CALL");
          console.log(watchRes);
          throw new Error("The Google Calendar API events.watch() call failed");
        }

        // we need to watch the primary calendar only once
        // the resourceId seems to relate to the primary calendar for whose
        // events we're initializing watching, however this resource id is not
        // visible anywhere in the API, so there's no way of retrieving it
        // outside of making the .watch() call and storing it for later
        await poolClient.query(
          `UPDATE users
           SET push_notification_channel_id = $1, push_notification_resource_id = $2, watching_until = $3
           WHERE id = $4`,
          [channelId, watchRes.data.resourceId, newWatchingUntil, user.id]
        );
      }

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
  const googleClient = req.googleClient;
  const calendarAPI: calendar_v3.Calendar = new calendar_v3.Calendar({
    auth: googleClient,
  });
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

    // if there are no more tracked recurring events, we want to go ahead and
    // delete push notifications from the user and tell Google to stop sending
    // them
    if (trackedRecurringEventsQuery.rows.length === 0) {
      await poolClient.query(
        `UPDATE users
         SET push_notification_channel_id = NULL, push_notification_resource_id = NULL, watching_until = NULL
         WHERE id = $1`,
        [user.id]
      );

      try {
        // it's possble we're repeating the delete a second time, and the channel has already been
        // stopped, so there's no point in repeating this operation since we
        // don't even track the original identifiers for the channel anymore
        // so we NOOP and proceed
        if (user.pushNotificationChannelId && user.pushNotificationResourceId) {
          await calendarAPI.channels.stop({
            requestBody: {
              id: user.pushNotificationChannelId,
              resourceId: user.pushNotificationResourceId,
            },
          });
        }
      } catch (stopError) {
        const err = stopError as GaxiosError;
        console.error(err);
        // it's possible this watching subscription has expired, so there's
        // nothing for us to stop watching on Google's end, and we can proceed
        // with the happy path
        if (err.code != "404") {
          throw stopError;
        } else {
          console.log("Gaxios resulted in a 404, but that's ok");
        }
      }
    }

    await poolClient.query("COMMIT");
    res.status(200).json({ message: "Tracking stopped" });
  } catch (e) {
    await poolClient.query("ROLLBACK");
    next(e);
  } finally {
    poolClient.release();
  }
}

// This sync only does work for the next two weeks, everything else gets wiped
// if it has no associated records in the system
export async function handleSync(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const pool = req.pool;
  const poolClient = await pool.connect();
  const googleClient = req.googleClient;
  const calendarAPI: calendar_v3.Calendar = new calendar_v3.Calendar({
    auth: googleClient,
  });
  const user = req.user as UserEntity;

  try {
    await poolClient.query("BEGIN");

    // this is the meat
    await runSync(calendarAPI, poolClient, user);

    await poolClient.query("COMMIT");
    res.status(200).json({ message: "Completed full resync of events" });
  } catch (e) {
    await poolClient.query("ROLLBACK");
    next(e);
  } finally {
    poolClient.release();
  }
}
