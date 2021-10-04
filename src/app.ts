import http from "http";
import express, { Express, Request, Response, NextFunction } from "express";
import morgan from "morgan";
import cors from "cors";
import helmet from "helmet";
import * as dotenv from "dotenv";
import { google, Auth, calendar_v3 } from "googleapis";

dotenv.config();

if (!process.env.PORT || !process.env.CLIENT_ID || !process.env.CLIENT_SECRET) {
  process.exit(1);
}

const PORT: number = parseInt(process.env.PORT as string, 10);

const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  "http://localhost:3000/oauth2callback"
);

const app: Express = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

/** Logging */
app.use(morgan("dev"));
/** Parse the request */
app.use(express.urlencoded({ extended: false }));
/** Takes care of JSON data */
app.use(express.json());

/** RULES OF OUR API */
app.use((req, res, next) => {
  // set the CORS policy
  res.header("Access-Control-Allow-Origin", "*");
  // set the CORS headers
  res.header(
    "Access-Control-Allow-Headers",
    "origin, X-Requested-With,Content-Type,Accept, Authorization"
  );
  // set the CORS method headers
  if (req.method === "OPTIONS") {
    res.header("Access-Control-Allow-Methods", "GET PATCH DELETE POST");
    return res.status(200).json({});
  }
  next();
});

/** Routes */
app.get("/", (request: Request, response: Response) => {
  const scopes = ["https://www.googleapis.com/auth/calendar.events.readonly"];
  const url = oauth2Client.generateAuthUrl({
    // 'online' (default) or 'offline' (gets refresh_token)
    access_type: "offline",

    // If you only need one scope you can pass it as a string
    scope: scopes,
  });
  response.json({ authUrl: url });
});

app.get(
  "/oauth2callback",
  async (request: Request, response: Response, next: NextFunction) => {
    // might want to check that you actually did get the code here
    // console.log(request.query.code);

    if (!request.query.code) {
      throw new Error("Code missing from Oauth2 Callback");
    }

    const code: string = request.query.code.toString();

    // console.log(code);

    // This will provide an object with the access_token and refresh_token.
    // Save these somewhere safe so they can be used at a later time.
    // const {tokens} = await oauth2Client.getToken(code)
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    response.json({ message: "Success: Oauth2 client credentials set!" });
  }
);

app.get("/events", async (request: Request, response: Response) => {
  // Note: using explicit types like `Auth.GoogleAuth` are only here for
  // demonstration purposes.  Generally with TypeScript, these types would
  // be inferred.
  // const auth = new google.auth.GoogleAuth();
  const calendar: calendar_v3.Calendar = google.calendar({
    version: "v3",
    auth: oauth2Client,
  });

  // // There are generated types for every set of request parameters
  // const listParams: drive_v3.Params$Resource$Files$List = {};
  // const res = await drive.files.list(listParams);

  // // There are generated types for the response fields as well
  // const listResults: drive_v3.Schema$FileList = res.data;
  // const params: calendar_v3.Paramsj
  // const auth: OAuth2Client = new google.auth.OAuth2(...);
  // const calendar: Calendar = google.calendar({ version: 'v3', auth });
  // const schemaEvent: Schema$Event = (await calendar.events.get({ calendarId, eventId })).data;
  const events = await calendar.events.list({
    calendarId: "primary",
    timeMin: new Date().toISOString(),
    maxResults: 10,
    singleEvents: true,
    orderBy: "startTime",
  });

  response.json(events);
});

// app.get("/redirect", (request: Request, response: Response) => {
//   console.log(request.url);
//   response.json({ message: "Welcome to the root URL" });
// });

/** Error handling */
app.use((req, res, next) => {
  const error = new Error("not found");
  return res.status(404).json({
    message: error.message,
  });
});

/** Server */
const httpServer = http.createServer(app);

httpServer.listen(PORT, () =>
  console.log(`The server is running on port ${PORT}`)
);
