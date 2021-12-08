import { calendar_v3 } from "@googleapis/calendar";
import { Request, Response, NextFunction } from "express";
import { UserEntity } from "../models/user";
import * as E from "../models/event";
// import { OAuth2Client } from "googleapis-common";
// import { GaxiosError } from "gaxios";

// extends the google schema for event with our own additional fields
interface APIEvent extends calendar_v3.Schema$Event {
  tracked: boolean;
}

//
// Keeping this around as an example of how to handle random gaxios errors that
// can always occur on the backend and that we should probably standardize
// handling at some point if we want to be bullet proof
//
// export function handleGet(oauth2Client: OAuth2Client) {
//   return async (
//     request: Request,
//     response: Response,
//     next: NextFunction
//   ): Promise<void> => {
//     const calendar: calendar_v3.Calendar = new calendar_v3.Calendar({
//       auth: oauth2Client,
//     });

//     await calendar.events.list(
//       {
//         calendarId: "primary",
//         timeMin: new Date().toISOString(),
//         // maxResults: 10,
//         // This parameter makes a huge difference to the output. With this on
//         // default you get only the base recurring event with RRULE and the
//         // exception one-offs, whereas without it you get the whole collection
//         // of everything fully expanded, which is a big deal
//         singleEvents: false,
//         // orderBy: "startTime",
//         showDeleted: true,
//       },
//       // not sure how to turn this generic Error into something I can query
//       (err, res) => {
//         const gaxiosError = err as GaxiosError;
//         if (err) {
//           // console.log("ERR");
//           console.log(err);
//           if (
//             gaxiosError.code === "400" &&
//             gaxiosError.response?.data.error === "invalid_grant"
//           ) {
//             console.log("YO: The token we're using is no longer valid!!");
//             // TODO: this happens when I remove the permission from the app in my
//             // google profile settings, so using the old token is no longer
//             // working. Ideally there would be some clever way here of telling the
//             // user that they need to re-authorize the app to access their Google
//             // Calendar data
//             // Throwing a 500 for now
//             next(err);
//           } else if (gaxiosError.code === "401") {
//             response.status(401).json({});
//           } else {
//             // catch all error, we don't have a good way of handling it
//             console.log("YO: Whoa, unidentified error~!!!!");
//             next(err);
//           }
//         } else {
//           if (res) {
//             // more of a memento for myself to remember what type this is
//             const events: calendar_v3.Schema$Events = res.data;
//             if (!events.items) {
//               throw new Error("The events response did not include items");
//             }
//             response.json(
//               events.items.filter((e) =>
//                 Object.prototype.hasOwnProperty.call(e, "recurrence")
//               )
//             );
//           } else {
//             response.json([]);
//           }
//         }
//       }
//     );
//   };
// }

export async function handleGet(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const pool = req.pool;
  const poolClient = await pool.connect();
  // const googleClient = req.googleClient;
  // const calendarAPI: calendar_v3.Calendar = new calendar_v3.Calendar({
  //   auth: googleClient,
  // });
  const user = req.user as UserEntity;

  try {
    const events = await E.findAllInstancesByOrganizer(
      poolClient,
      user.googleId
    );
    res.status(200).json(events);
  } catch (err) {
    console.log(err);
    next(err);
  } finally {
    poolClient.release();
  }
}
