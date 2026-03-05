import { beforeEach, describe, expect, it, vi } from "vitest";
import { exportToExcel } from "./exportUtils";

describe("exportToExcel", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(URL, "createObjectURL", {
      value: vi.fn(() => "blob:mock-url"),
      writable: true,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      value: vi.fn(),
      writable: true,
    });
  });

  it("creates a downloadable csv link", () => {
    const appendSpy = vi.spyOn(document.body, "appendChild");
    const removeSpy = vi.spyOn(document.body, "removeChild");
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    const createUrlSpy = vi.spyOn(URL, "createObjectURL");
    const revokeUrlSpy = vi.spyOn(URL, "revokeObjectURL");

    exportToExcel(
      [{ name: "Admin", amount: 12.5 }],
      "billing-export",
      ["Name", "Amount"],
      (row) => [row.name, row.amount]
    );

    expect(appendSpy).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(createUrlSpy).toHaveBeenCalledTimes(1);
    expect(revokeUrlSpy).toHaveBeenCalledWith("blob:mock-url");
  });
});
