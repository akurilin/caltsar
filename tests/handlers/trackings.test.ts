import app from "../../src/app";
// import http from "http";
// import { Express } from "express";
import request from "supertest";

// let server: Express;

beforeAll(async () => {
  // server = await http.createServer(app);
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
