import http from "http";
import app from "./app";
// import * as dotenv from "dotenv";

// dotenv.config();
if (!process.env.PORT) {
  console.error("Environment variable PORT not set");
  process.exit(1);
}

const PORT: number = parseInt(process.env.PORT as string, 10);

/** Server */
const httpServer = http.createServer(app);

httpServer.listen(PORT, () =>
  console.log(`The server is running on port ${PORT}`)
);
