import http from "http";
import app from "./app";

if (!process.env.PORT) {
  console.error("The app is missing a mandatory environment variable");
  process.exit(1);
}

const PORT: number = parseInt(process.env.PORT as string, 10);

/** Server */
const httpServer = http.createServer(app);

httpServer.listen(PORT, () =>
  console.log(`The server is running on port ${PORT}`)
);
