import http from "http";
import express, { Express, Request, Response, NextFunction } from "express";
import morgan from "morgan";
import cors from "cors";
import helmet from "helmet";
import * as dotenv from "dotenv";
import { calendar_v3, auth } from "@googleapis/calendar";
import fs from "fs";

dotenv.config();

if (!process.env.PORT || !process.env.CLIENT_ID || !process.env.CLIENT_SECRET) {
  process.exit(1);
}

const PORT: number = parseInt(process.env.PORT as string, 10);

const TOKEN_PATH = "dist/token.json";

const oauth2Client = new auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  "http://localhost:3000/oauth2callback"
);

// console.log(`Existing credentials:`);
// console.log(oauth2Client.credentials);

fs.readFile(TOKEN_PATH, (err, token) => {
  if (!err) {
    console.log("Token found on disk on app startup");
    console.log(`Here's the token read from disk: ${token.toString()}`);
    oauth2Client.setCredentials(JSON.parse(token.toString()));
  }
});

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
  if (isEmpty(oauth2Client.credentials)) {
    const scopes = ["https://www.googleapis.com/auth/calendar.events.readonly"];
    const url = oauth2Client.generateAuthUrl({
      // 'online' (default) or 'offline' (gets refresh_token)
      access_type: "offline",

      // If you only need one scope you can pass it as a string
      scope: scopes,
    });
    response.json({
      message: "Action: Please go to following URL to authorize the app",
      authUrl: url,
    });
  } else {
    // console.log(`Here's the token read from disk: ${token.toString()}`);
    // oauth2Client.setCredentials(JSON.parse(token.toString()));
    response.json({ message: "Success: You're already authorized." });
  }
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

    // this would eventually go in a database associated with the specific user
    fs.writeFile(TOKEN_PATH, JSON.stringify(tokens), (err) => {
      if (err) return console.error(err);
      console.log("Token stored to", TOKEN_PATH);
    });

    response.json({ message: "Success: Oauth2 client credentials set!" });
  }
);

app.get("/events", async (request: Request, response: Response) => {
  const calendar: calendar_v3.Calendar = new calendar_v3.Calendar({
    auth: oauth2Client,
  });

  let googleResponse = await calendar.events
    .list({
      calendarId: "primary",
      timeMin: new Date().toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: "startTime",
    })
    .catch((e) => {
      // TODO: figure out how to identify the issue
      console.log(e);

      // Works! We can narrow 'err' from 'unknown' to 'Error'.
      if (e instanceof Error) {
        throw new Error(e.message);
      }

      throw new Error("Error: unidentified error");
    });

  response.json(googleResponse.data);
});

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

function isEmpty(o: Object): boolean {
  return Object.keys(o).length === 0;
}
