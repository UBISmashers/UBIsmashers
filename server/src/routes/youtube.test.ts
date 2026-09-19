import { describe, expect, it } from "vitest";

import { shouldAcceptLiveCandidate } from "./youtube.js";

describe("YouTube live candidate validation", () => {
  it("accepts the reported active UBI Smashers video from an eventType=live search", () => {
    expect(shouldAcceptLiveCandidate("7_F9mcmqfyk", "live", undefined)).toBe(true);
  });

  it("accepts a valid video when YouTube reports liveBroadcastContent=live", () => {
    expect(shouldAcceptLiveCandidate("7_F9mcmqfyk", undefined, "live")).toBe(true);
  });

  it("rejects invalid IDs and streams without an active live indication", () => {
    expect(shouldAcceptLiveCandidate("invalid", "live", "live")).toBe(false);
    expect(shouldAcceptLiveCandidate("7_F9mcmqfyk", undefined, "upcoming")).toBe(false);
  });
});
