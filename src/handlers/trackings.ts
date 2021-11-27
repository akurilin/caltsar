import { Request, Response, NextFunction } from "express";
import { calendar_v3 } from "@googleapis/calendar";

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
  res: Response
  // next: NextFunction
): Promise<void> {
  // TODO:
  // 1) Download two weeks worth of events
  // 2) Store events in the db AND change the tracking of of the recurring
  // event in the same transaction for the sake of consistency
  // 3) Create push notification subscription with Google API ASSUMING TRACKING
  // THE RECURRING EVENT WILL TRACK ALL OF THE SUB-EVENTS AND YOU DON'T HAVE TO
  // TRACK THEM ALL INDIVIDUALLY YIKES...

  const pool = req.pool;
  const pgClient = await pool.connect();
  const googleClient = req.googleClient;
  const recurringEventId = req.params.recurringEventId;
  const calendar: calendar_v3.Calendar = new calendar_v3.Calendar({
    auth: googleClient,
  });

  try {
    console.log("Calling Google Calendar API");

    // TODO: convert this call to getting a list of events
    const getResult = await calendar.events.get({
      calendarId: "primary",
      eventId: recurringEventId,
      maxAttendees: 1,
    });

    const now = new Date();
    const twoWeeksLater = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 14);

    const params = {
      calendarId: "primary",
      eventId: recurringEventId,
      timeMin: new Date().toISOString(),
      timeMax: twoWeeksLater.toISOString(),
      // NB: this might make a difference here if we're looking for events that
      // are going to be skipped ad-hoc and we don't want to blast people about
      // them
      // showDeleted: true,
    };

    // console.log(params);

    const listResult = await calendar.events.instances(params);

    console.log(listResult.data.items);

    // optimistically proceeding here assuming a 200 response, but of course
    // the event might have gotten deleted at some point in the past
    const event: calendar_v3.Schema$Event = getResult.data;

    await pgClient.query("BEGIN");
    await pgClient.query(
      "INSERT INTO recurring_events (google_id, summary, tracked) VALUES ($1, $2, $3) ON CONFLICT (google_id) DO NOTHING",
      [event.id, event.summary, true]
    );

    // const events: calendar;

    await pgClient.query("COMMIT");
    res
      .status(200)
      .json({ message: "TODO: IMPLEMENT ME Tracking initiated successfully" });
  } catch (e) {
    await pgClient.query("ROLLBACK");
    throw e;
  } finally {
    pgClient.release();
  }
}

export async function handleDelete(req: Request, res: Response): Promise<void> {
  // TODO:
  // In the same transaction:
  // 1. Delete all events with no existing associated submitted survey responses
  // 2. Mark the recurring event as not tracked
  // 3. Remove push notification subscription with Google API
  res.status(404).json({ message: "TODO: IMPLEMENT ME Tracking stopped" });
}

// TODO:
// This goes into another file
// export async sunction handlePushNotificationPost(...) {
// if message type is "exists" then check if you even have something with that
// resource ID and if you do go ahead and
// }

// export async function handlePostFullResync(
//   req: Request,
//   res: Response
// ): Promise<void> {
//   res.status(404).json({ message: "TODO: IMPLEMENT ME full resync of events" });
// }
