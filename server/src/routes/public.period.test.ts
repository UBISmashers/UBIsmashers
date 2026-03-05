import { describe, expect, it } from "vitest";
import { getPeriodStartDate, PERIOD_VALUES } from "./public.js";

describe("Public period helpers", () => {
  it("includes supported period values", () => {
    expect(PERIOD_VALUES.has("all")).toBe(true);
    expect(PERIOD_VALUES.has("this_month")).toBe(true);
    expect(PERIOD_VALUES.has("last_week")).toBe(true);
    expect(PERIOD_VALUES.has("last_month")).toBe(true);
    expect(PERIOD_VALUES.has("last_6_months")).toBe(true);
    expect(PERIOD_VALUES.has("last_year")).toBe(true);
  });

  it("returns null for unknown period", () => {
    expect(getPeriodStartDate("not_a_period")).toBeNull();
  });

  it("returns month-start date for this_month", () => {
    const start = getPeriodStartDate("this_month");

    expect(start).not.toBeNull();
    expect(start?.getDate()).toBe(1);
    expect(start?.getHours()).toBe(0);
    expect(start?.getMinutes()).toBe(0);
    expect(start?.getSeconds()).toBe(0);
  });
});
