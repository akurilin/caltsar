import { calendar_v3 } from "@googleapis/calendar";
import pgformat from "pg-format";
import { UserEntity } from "../models/user";
import {
  RecurringEvent,
  convertGoogleEventsToRecurringEvents,
  insertRecurringEvents,
} from "../models/recurring-event";
import { PoolClient } from "pg";
import dayjs from "dayjs";

// call Events.List and paginate the results if they exceed maxResults
async function paginateList(
  options: calendar_v3.Params$Resource$Events$List,
  calendarAPI: calendar_v3.Calendar
): Promise<calendar_v3.Schema$Event[]> {
  let events: calendar_v3.Schema$Event[] = [];
  let eventsRes = null;

  do {
    let nextPageToken = undefined;
    if (eventsRes && eventsRes.data.nextPageToken) {
      nextPageToken = eventsRes.data.nextPageToken;
    } else {
      nextPageToken = undefined;
    }

    // retrieve all instances that we'll want to re-add to the
    // undefined pageToken == first call to the API
    console.log(`Calling events.list with pageToken ${nextPageToken}`);
    options.pageToken = nextPageToken;
    eventsRes = await calendarAPI.events.list(options);

    if (eventsRes.data.items) {
      events = events.concat(eventsRes.data.items);
    }
  } while (eventsRes.data.nextPageToken);

  return events;
}

// I sense this function call can get pretty taxing both on memory and on the
// database for a sufficiently old and beefy calendar
// assumes a transaction was already started by the caller of this fn
export async function runSync(
  poolClient: PoolClient,
  calendarAPI: calendar_v3.Calendar,
  user: UserEntity
): Promise<void> {
  console.log("runSync");
  // const poolClient = await pool.connect();
  // NB this will all be done in server time (likely UTC), but at some point
  // we'll want to do this with respect to the local time of the calendar we're
  // working with
  const now = dayjs();
  const beginningOfMonth = now
    .date(1)
    .hour(0)
    .minute(0)
    .second(0)
    .millisecond(0);
  const from = beginningOfMonth.subtract(1, "second").toISOString();
  const to = beginningOfMonth.add(2, "month").toISOString();

  // console.log(from);
  // console.log(to);

  const allRecurringEvents = await paginateList(
    {
      calendarId: "primary",
      singleEvents: false,
      showDeleted: true,
      timeMin: from,
      timeMax: to,
      maxResults: 2500,
      pageToken: undefined,
    },
    calendarAPI
  );

  const allActiveInstances = await paginateList(
    {
      calendarId: "primary",
      singleEvents: true,
      showDeleted: false,
      timeMin: from,
      timeMax: to,
      maxResults: 2500,
      pageToken: undefined,
    },
    calendarAPI
  );

  const activeRecurring = allRecurringEvents.filter(
    (i) =>
      i.status != "cancelled" &&
      i.recurrence &&
      i.organizer &&
      i.organizer.email == user.email
  );
  const cancelledRecurring = allRecurringEvents.filter(
    (i) =>
      i.status == "cancelled" &&
      i.recurrence &&
      i.organizer &&
      i.organizer.email == user.email
  );
  const activeInstances = allActiveInstances.filter(
    (i) => i.recurringEventId && i.organizer && i.organizer.email == user.email
  );

  // NB: we're blowing away all of the events corresponding to all of the
  // recurring events in the selected time period
  await poolClient.query(
    pgformat(
      "DELETE FROM events WHERE recurring_event_google_id IN (%L)",
      allRecurringEvents.map((e) => e.id)
    )
  );

  await poolClient.query(
    pgformat(
      "DELETE FROM recurring_events WHERE google_id IN (%L)",
      cancelledRecurring.map((e) => e.id)
    )
  );

  // we will attempt to insert remaining active recurring events a second time
  // and ignore the confict when it happens
  // const insertRecurringEventsQuery = pgformat(
  //   `INSERT INTO recurring_events (google_id, summary, tracked, organizer_google_id) VALUES %L ON CONFLICT (google_id) DO UPDATE SET summary = EXCLUDED.summary`,
  //   activeRecurring.map((e) => [e.id, e.summary, false, user.googleId])
  // );
  // const input: RecurringEvent[] = activeRecurring.map(e => return {googleId: e.id, summary: e.summary, tracked: false, organizerGoogleId: user.googleId});
  await insertRecurringEvents(
    poolClient,
    convertGoogleEventsToRecurringEvents(activeRecurring, user.googleId)
  );
  // console.log(insertRecurringEventsQuery);
  // await poolClient.query(insertRecurringEventsQuery);

  const instancesValues = activeInstances.map((event) => {
    if (
      !event.start ||
      !event.start.dateTime ||
      !event.end ||
      !event.end.dateTime ||
      // the two timezones should always be the same
      !event.end.timeZone
    ) {
      throw new Error("The event is missing end time properties");
    }
    return [
      event.id,
      event.recurringEventId,
      new Date(event.start.dateTime),
      new Date(event.end.dateTime),
      event.end.timeZone,
      event.summary,
    ];
  });
  const insertInstancesQuery = pgformat(
    `INSERT INTO events (google_id, recurring_event_google_id, start_date_time, end_date_time, time_zone, summary)
     VALUES %L
     ON CONFLICT (google_id) DO UPDATE SET start_date_time = EXCLUDED.start_date_time, end_date_time = EXCLUDED.end_date_time, time_zone = EXCLUDED.time_zone`,
    instancesValues
  );
  await poolClient.query(insertInstancesQuery);
}
