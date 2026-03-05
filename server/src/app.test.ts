import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "./app.js";

describe("App health check", () => {
  it("returns API health payload", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
      message: "Court Cost Connect API is running",
    });
  });
});
