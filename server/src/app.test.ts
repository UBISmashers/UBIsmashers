import request from "supertest";
import { describe, expect, it } from "vitest";

import app from "./app.js";

describe("CORS configuration", () => {
  it("allows preflight requests from the production frontend", async () => {
    const response = await request(app)
      .options("/api/public/bills")
      .set("Origin", "https://ubismashers.vercel.app")
      .set("Access-Control-Request-Method", "GET")
      .set("Access-Control-Request-Headers", "content-type,authorization");

    expect(response.status).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "https://ubismashers.vercel.app"
    );
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
    expect(response.headers["access-control-allow-headers"]).toContain("content-type");
    expect(response.headers["access-control-allow-headers"]).toContain("authorization");
  });
});
