import { describe, expect, it } from "vitest";
import {
  getCurrentMonthDateRange,
  getPeriodDateRange,
  getPeriodStartDate,
  PERIOD_VALUES,
} from "./public.js";

describe("Public period helpers", () => {
  it("includes supported period values", () => {
    expect(PERIOD_VALUES.has("all")).toBe(true);
    expect(PERIOD_VALUES.has("custom")).toBe(true);
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

  it("returns previous calendar month range for last_month", () => {
    const range = getPeriodDateRange("last_month");

    expect(range).not.toBeNull();
    if (!range) return;

    const now = new Date();
    const expectedStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
    const expectedEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    expect(range.start.getTime()).toBe(expectedStart.getTime());
    expect(range.end.getTime()).toBe(expectedEnd.getTime());
  });

  it("returns valid range for custom period", () => {
    const range = getPeriodDateRange("custom", "2026-02-01", "2026-02-28");

    expect(range).not.toBeNull();
    if (!range) return;
    expect(range.start.getFullYear()).toBe(2026);
    expect(range.start.getMonth()).toBe(1);
    expect(range.start.getDate()).toBe(1);
    expect(range.end.getFullYear()).toBe(2026);
    expect(range.end.getMonth()).toBe(1);
    expect(range.end.getDate()).toBe(28);
  });

  it("returns the current calendar month range", () => {
    const referenceDate = new Date("2026-03-11T10:15:00.000Z");
    const range = getCurrentMonthDateRange(referenceDate);

    expect(range.start.getFullYear()).toBe(2026);
    expect(range.start.getMonth()).toBe(2);
    expect(range.start.getDate()).toBe(1);
    expect(range.start.getHours()).toBe(0);
    expect(range.end.getFullYear()).toBe(2026);
    expect(range.end.getMonth()).toBe(2);
    expect(range.end.getDate()).toBe(31);
    expect(range.end.getHours()).toBe(23);
  });
});
