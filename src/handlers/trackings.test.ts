import app, { pool } from "../app";
import request from "supertest";

// let server: Express;

//                sid                |                                                                             sess                                                                              |       expire
// ----------------------------------+---------------------------------------------------------------------------------------------------------------------------------------------------------------+---------------------
// yNyprl6LhCuDZX9YsDAl3NUeGqrvyujd | {"cookie":{"originalMaxAge":2592000000,"expires":"2021-11-16T21:02:53.162Z","secure":false,"httpOnly":true,"path":"/","sameSite":true},"passport":{"user":1}} | 2021-11-16 21:03:07
// caltsar_dev=# select * from users;
//  id |       google_id       |           email            | first_name | last_name |          created_at           |          updated_at           |                                                                            access_token                                                                             |                                              refresh_token
// ----+-----------------------+----------------------------+------------+-----------+-------------------------------+-------------------------------+---------------------------------------------------------------------------------------------------------------------------------------------------------------------+---------------------------------------------------------------------------------------------------------
//   1 | 113738270040001178733 | alexandr.kurilin@gmail.com | Alexandr   | Kurilin   | 2021-10-17 21:02:53.163569+00 | 2021-10-17 21:02:53.163569+00 | REDACTED_ACCESS_TOKEN_2 | REDACTED_REFRESH_TOKEN_2
beforeAll(async () => {
  try {
    await pool.query(
      `INSERT INTO users(id, google_id, email, first_name, last_name, created_at, updated_at, access_token, refresh_token)
       VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO NOTHING`,
      [1, "123", "alex@foo.bar", "A", "K", new Date(), new Date(), "foo", "bar"]
    );
    await pool.query(
      `INSERT INTO sessions (sid, sess, expire)
      VALUES($1, $2, $3)
      ON CONFLICT (sid) DO NOTHING`,
      [
        "yNyprl6LhCuDZX9YsDAl3NUeGqrvyujd",
        '{"cookie":{"originalMaxAge":2592000000,"expires":"2030-01-01T00:00:00.000Z","secure":false,"httpOnly":true,"path":"/","sameSite":true},"passport":{"user":1}}',
        new Date("2030-01-01"),
      ]
    );
  } catch (error) {
    console.error(error);
    process.exit(-1);
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

  it("should return a 200", async () => {
    await request(app)
      .delete("/trackings/123")
      .set(
        "Cookie",
        "connect.sid=s%3AyNyprl6LhCuDZX9YsDAl3NUeGqrvyujd.2v7h9lOkjq0jO%2FJSEVzqSrZ8zhuWER8m5TM8dFqwwrs"
      )
      .send()
      .expect("Content-Type", /json/)
      .expect(200);
  });
});

// Cookie: connect.sid=s%3AyNyprl6LhCuDZX9YsDAl3NUeGqrvyujd.2v7h9lOkjq0jO%2FJSEVzqSrZ8zhuWER8m5TM8dFqwwrs
