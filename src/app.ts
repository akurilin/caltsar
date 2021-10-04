import http from "http";
import express, { Express, Request, Response } from "express";
import morgan from "morgan";
import cors from "cors";
import helmet from "helmet";
import * as dotenv from "dotenv";

dotenv.config();

if (!process.env.PORT) {
  process.exit(1);
}

const PORT: number = parseInt(process.env.PORT as string, 10);

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
  console.log(request.url);
  response.json({ message: "Welcome to the root URL" });
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
