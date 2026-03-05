import { render, screen } from "@testing-library/react";
import { DollarSign } from "lucide-react";
import { describe, expect, it } from "vitest";
import { StatCard } from "./StatCard";

describe("StatCard", () => {
  it("renders title, value, and description", () => {
    render(
      <StatCard
        title="Total Paid"
        value="$120.00"
        description="Payments received"
        icon={DollarSign}
      />
    );

    expect(screen.getByText("Total Paid")).toBeInTheDocument();
    expect(screen.getByText("$120.00")).toBeInTheDocument();
    expect(screen.getByText("Payments received")).toBeInTheDocument();
  });
});
