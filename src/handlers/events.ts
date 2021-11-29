import { calendar_v3 } from "@googleapis/calendar";
import { Request, Response, NextFunction } from "express";
import { GaxiosError } from "gaxios";
import { OAuth2Client } from "googleapis-common";

export function handleGet(oauth2Client: OAuth2Client) {
  return async (
    request: Request,
    response: Response,
    next: NextFunction
  ): Promise<void> => {
    const calendar: calendar_v3.Calendar = new calendar_v3.Calendar({
      auth: oauth2Client,
    });

    await calendar.events.list(
      {
        calendarId: "primary",
        timeMin: new Date().toISOString(),
        maxResults: 10,
        // This parameter makes a huge difference to the output. With this on
        // default you get only the base recurring event with RRULE and the
        // exception one-offs, whereas without it you get the whole collection
        // of everything fully expanded, which is a big deal
        singleEvents: true,
        orderBy: "startTime",
        showDeleted: true,
      },
      // not sure how to turn this generic Error into something I can query
      (err, res) => {
        const gaxiosError = err as GaxiosError;
        if (err) {
          // console.log("ERR");
          console.log(err);
          if (
            gaxiosError.code === "400" &&
            gaxiosError.response?.data.error === "invalid_grant"
          ) {
            console.log("YO: The token we're using is no longer valid!!");
            // TODO: this happens when I remove the permission from the app in my
            // google profile settings, so using the old token is no longer
            // working. Ideally there would be some clever way here of telling the
            // user that they need to re-authorize the app to access their Google
            // Calendar data
            // Throwing a 500 for now
            next(err);
          } else if (gaxiosError.code === "401") {
            response.status(401).json({});
          } else {
            // catch all error, we don't have a good way of handling it
            console.log("YO: Whoa, unidentified error~!!!!");
            next(err);
          }
        } else {
          if (res) {
            // more of a memento for myself to remember what type this is
            const events: calendar_v3.Schema$Events = res.data;
            response.json(events);
          } else {
            response.json([]);
          }
        }
      }
    );
  };
}
