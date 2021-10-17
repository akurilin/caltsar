import app, { pool } from "../../src/app";
// import http from "http";
// import { Express } from "express";
import request from "supertest";

// let server: Express;

// beforeAll(async () => {});
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

  // it("should return a 200", async () => {
  //   await request(app)
  //     .delete("/trackings/123")
  //     .expect("Content-Type", /json/)
  //     .expect(200);
  // });
});
