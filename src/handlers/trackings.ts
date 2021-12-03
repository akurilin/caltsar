import { Request, Response, NextFunction } from "express";
import { calendar_v3 } from "@googleapis/calendar";
import pgformat from "pg-format";
import { PoolClient } from "pg";
import { UserEntity } from "../models/user";
import { v4 as uuidv4 } from "uuid";

async function upsertInstances(
  pgClient: PoolClient,
  instances: calendar_v3.Schema$Event[]
) {
  const values = instances
    .filter((item) => item.status != "cancelled")
    .map((item) => {
      if (!item.end || !item.end.dateTime || !item.end.timeZone) {
        throw new Error("The event is missing end time properties");
      }
      return [
        item.id,
        item.recurringEventId,
        new Date(item.end.dateTime),
        item.end.timeZone,
      ];
    });

  console.log(`Upserting event instances:`);
  values.forEach((v) => console.log(v));

  const insertEventsQuery = pgformat(
    "INSERT INTO events (google_id, recurring_event_google_id, end_date_time, time_zone) VALUES %L ON CONFLICT (google_id) DO UPDATE SET end_date_time = EXCLUDED.end_date_time, time_zone = EXCLUDED.time_zone",
    values
  );
  await pgClient.query(insertEventsQuery);
}

// NB: this is likely the wrong response if the user has already some
//     data associated here unless they explicitly want to delete all of the
//     data and don't care about preserving history
function deleteRecurring(
  pgClient: PoolClient,
  instances: calendar_v3.Schema$Event[]
) {
  const cancelledGoogleIds = instances.map((item) => item.id);
  console.log(`DELETE-ing all recurring_events with ids:`);
  console.log(cancelledGoogleIds);
  if (cancelledGoogleIds.length > 0) {
    const deleteQuery = pgformat(
      "DELETE FROM recurring_events WHERE google_id in (%L)",
      cancelledGoogleIds
    );
    return pgClient.query(deleteQuery);
  } else {
    return Promise.resolve(0);
  }
}

function deleteInstances(
  pgClient: PoolClient,
  instances: calendar_v3.Schema$Event[]
) {
  const cancelledGoogleIds = instances.map((item) => item.id);
  console.log(`DELETE-ing all events instances with ids:`);
  console.log(cancelledGoogleIds);
  if (cancelledGoogleIds.length > 0) {
    const deleteQuery = pgformat(
      "DELETE FROM events WHERE google_id in (%L)",
      cancelledGoogleIds
    );
    return pgClient.query(deleteQuery);
  } else {
    return Promise.resolve(0);
  }
}

// just for testing
export async function handleGet(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const queryRes = await req.pool.query("SELECT * FROM trackings");
    res.status(200).json(queryRes.rows);
  } catch (e) {
    console.log(e);
    return next(e);
    // res.status(500).json({ message: "Database error" });
  }
}

export async function handlePost(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const user = req.user as UserEntity;
  const pool = req.pool;
  const pgClient = await pool.connect();
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
      // fetch and store active instances of the recurring event for the next
      // period of time
      const now = new Date();
      const twoWeeksLater = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 14);
      const listResult = await calendarAPI.events.instances({
        calendarId: "primary",
        eventId: recurringEventId,
        timeMin: new Date().toISOString(),
        timeMax: twoWeeksLater.toISOString(),
        // NB: this might make a difference here if we're looking for events that
        // are going to be skipped ad-hoc and we don't want to blast people about
        // them
        showDeleted: true,
      });

      await pgClient.query("BEGIN");

      await pgClient.query(
        "INSERT INTO recurring_events (google_id, summary, tracked, organizer_google_id) VALUES ($1, $2, $3, $4) ON CONFLICT (google_id) DO NOTHING",
        [event.id, event.summary, true, user.googleId]
      );

      if (!listResult.data) {
        throw new Error("The recurring event was associated with no events");
      }
      if (!listResult.data.items || listResult.data.items.length === 0) {
        throw new Error("The recurring event was associated with no events");
      }

      await upsertInstances(
        pgClient,
        listResult.data.items.filter((i) => i.status !== "cancelled")
      );

      // delete cancelled events
      // NB: this will blow up once something starts pointing at these events
      await deleteInstances(
        pgClient,
        listResult.data.items.filter((i) => i.status === "cancelled")
      );

      const watchParams: calendar_v3.Schema$Channel = {
        id: uuidv4(),
        type: "web_hook",
        params: { ttl: "1800" },
        address: "https://app.akurilin.com/notifications",
      };

      const watchRes = await calendarAPI.events.watch({
        calendarId: "primary",
        requestBody: watchParams,
      });

      // TODO: blow up on status 400
      // test if it goes into the catch block on 400 anyway

      console.log("RESULT OF WATCH");
      console.log(watchRes);

      await pgClient.query("COMMIT");
      res.status(200).json({
        message: "Tracking initiated successfully",
      });
    }
  } catch (e) {
    await pgClient.query("ROLLBACK");
    next(e);
  } finally {
    pgClient.release();
  }
}

export async function handleDelete(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const pool = req.pool;
  const pgClient = await pool.connect();
  const user = req.user as UserEntity;
  try {
    await pgClient.query("BEGIN");

    const recEventRes = await pgClient.query(
      "SELECT * FROM recurring_events WHERE google_id = $1",
      [req.params.recurringEventId]
    );

    // make sure this deletion is authorized
    if (
      recEventRes.rows[0] &&
      recEventRes.rows[0]["organizer_google_id"] === user.googleId
    ) {
      // for now intentionally not resetting the organizer_google_id back
      await pgClient.query(
        "UPDATE recurring_events SET tracked = false WHERE google_id = $1",
        [req.params.recurringEventId]
      );

      // This should eventually check if anything of value is pointing to it so
      // that it's not removed accidentally or to prevent the query from failing
      await pgClient.query(
        "DELETE FROM events WHERE recurring_event_google_id = $1",
        [req.params.recurringEventId]
      );

      // TODO:
      // 3. Remove push notification subscription with Google API
      //
      await pgClient.query("COMMIT");
      res.status(200).json({ message: "Tracking stopped" });
    } else {
      res.status(400).json({ message: "No permission" });
    }
  } catch (e) {
    await pgClient.query("ROLLBACK");
    next(e);
  } finally {
    pgClient.release();
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
  const pgClient = await pool.connect();
  const googleClient = req.googleClient;
  const calendarAPI: calendar_v3.Calendar = new calendar_v3.Calendar({
    auth: googleClient,
  });

  try {
    await pgClient.query("BEGIN");

    // query all recurring events that will occur in the future currently
    // visible to us through the API
    const allEvents = await calendarAPI.events.list({
      calendarId: "primary",
      singleEvents: false,
      showDeleted: true,
      timeMin: new Date().toISOString(),
    });

    // console.log(allEvents);
    if (!allEvents.data || !allEvents.data.items) {
      throw new Error("Could not fetch full list of events");
    }

    // clean up recurring events that have been deleted from Google Calendar
    const cancelledRecurring = allEvents.data.items.filter(
      (e) =>
        e.status === "cancelled" &&
        Object.prototype.hasOwnProperty.call(e, "recurrence")
    );
    await deleteRecurring(pgClient, cancelledRecurring);

    // 1. fetch all currently tracked recurring events for this user
    const recurringEvents = await pgClient.query(
      "SELECT * FROM recurring_events WHERE tracked = true",
      []
    );

    const now = new Date();
    const twoWeeksLater = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 14);

    const promises = recurringEvents.rows.map((event) => {
      return calendarAPI.events.instances({
        calendarId: "primary",
        eventId: event["google_id"],
        timeMin: new Date().toISOString(),
        timeMax: twoWeeksLater.toISOString(),
        // NB: this might make a difference here if we're looking for events that
        // are going to be skipped ad-hoc and we don't want to blast people about
        // them
        showDeleted: true,
      });
    });

    const resolved = await Promise.all(promises);
    let allInstances: calendar_v3.Schema$Event[] = [];
    resolved.forEach((promise) => {
      if (promise.data.items) {
        allInstances = allInstances.concat(promise.data.items);
      }
    });

    await upsertInstances(
      pgClient,
      allInstances.filter((i) => i.status !== "cancelled")
    );

    // delete cancelled events
    // NB: this will blow up once something starts pointing at these events
    await deleteInstances(
      pgClient,
      allInstances.filter((i) => i.status === "cancelled")
    );

    // TODO: subscribe to push notifications for each recurring event

    await pgClient.query("COMMIT");
  } catch (e) {
    await pgClient.query("ROLLBACK");
    next(e);
  } finally {
    pgClient.release();
  }

  res.status(200).json({ message: "Completed full resync of events" });
}
