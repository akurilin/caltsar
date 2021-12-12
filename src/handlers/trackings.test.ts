import app, { pool } from "../app";
import request from "supertest";
import * as U from "../models/user";
import * as RE from "../models/recurring-event";

let recurringEvent: RE.RecurringEvent | null = null;
const cookieVal =
  "connect.sid=s%3AyNyprl6LhCuDZX9YsDAl3NUeGqrvyujd.2v7h9lOkjq0jO%2FJSEVzqSrZ8zhuWER8m5TM8dFqwwrs";

beforeAll(async () => {
  const poolClient = await pool.connect();
  try {
    await poolClient.query("BEGIN");
    await poolClient.query("TRUNCATE users CASCADE");
    await poolClient.query("TRUNCATE sessions CASCADE");
    const user = await U.createUser(
      poolClient,
      {
        googleId: "123",
        firstName: "Alice",
        lastName: "Andrews",
        email: "alice.andrews@gmail.com",
        accessToken: "foo",
        refreshToken: "bar",
      },
      () => {}
    );
    await poolClient.query(
      `INSERT INTO sessions (sid, sess, expire)
       VALUES($1, $2, $3)
       ON CONFLICT (sid) DO NOTHING`,
      [
        "yNyprl6LhCuDZX9YsDAl3NUeGqrvyujd",
        `{"cookie":{"originalMaxAge":2592000000,"expires":"2030-01-01T00:00:00.000Z","secure":false,"httpOnly":true,"path":"/","sameSite":true},"passport":{"user":${user.id}}}`,
        new Date("2030-01-01"),
      ]
    );

    recurringEvent = {
      googleId: "rec-event-google-id",
      summary: "My Summary",
      tracked: true,
      organizerGoogleId: user.googleId,
    };

    // create a tracked recurring event
    await RE.insertRecurringEvents(poolClient, [recurringEvent]);
    await poolClient.query("COMMIT");
  } catch (error) {
    await poolClient.query("ROLLBACK");
    console.error(error);
    process.exit(-1);
  } finally {
    poolClient.release();
  }
});

afterAll(async () => {
  // you'll want to be careful with this since it can only be called once per
  // run unless you're planning to re-populate the pool
  await pool.end();
});

describe("DELETE /trackings/123", () => {
  it("should return a 401 when unauthenticated", async () => {
    await request(app)
      .delete("/trackings/123")
      .expect("Content-Type", /json/)
      .expect(401);
  });

  it("should return a 4** when deleting tracking on a non-existing recurring event", async () => {
    await request(app)
      .delete("/trackings/1111111")
      .set("Cookie", cookieVal)
      .send()
      .expect("Content-Type", /json/)
      .expect(400);
  });

  it("should return a 200 on deleting tracking", async () => {
    await request(app)
      .delete(`/trackings/${recurringEvent && recurringEvent.googleId}`)
      .set("Cookie", cookieVal)
      .send()
      .expect("Content-Type", /json/)
      .expect(200);
  });

  it("should return a 200 on re-deleting tracking", async () => {
    await request(app)
      .delete(`/trackings/${recurringEvent && recurringEvent.googleId}`)
      .set("Cookie", cookieVal)
      .send()
      .expect("Content-Type", /json/)
      .expect(200);
  });

  it("should return a 200 on tracking creation", async () => {
    await request(app)
      .post(`/trackings/${recurringEvent && recurringEvent.googleId}`)
      .set("Cookie", cookieVal)
      .send()
      .expect("Content-Type", /json/)
      .expect(200);
  });

  it("should return a 200 on tracking re-creation", async () => {
    await request(app)
      .post(`/trackings/${recurringEvent && recurringEvent.googleId}`)
      .set("Cookie", cookieVal)
      .send()
      .expect("Content-Type", /json/)
      .expect(200);
  });
});
