import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AvailabilityBadge } from "./AvailabilityBadge";

afterEach(() => {
  cleanup();
});

describe("AvailabilityBadge", () => {
  it("shows availability status and lot counts", () => {
    render(
      <AvailabilityBadge
        availableLots={60}
        totalLots={100}
        status="High"
        isStale={false}
      />,
    );

    expect(screen.getByText("High")).toBeTruthy();
    expect(screen.getByText("60 / 100 lots available")).toBeTruthy();
  });

  it("shows stale warning when data is outdated", () => {
    render(
      <AvailabilityBadge
        availableLots={20}
        totalLots={100}
        status="Moderate"
        isStale={true}
      />,
    );

    expect(screen.getByText("Availability data may be outdated")).toBeTruthy();
  });

  it("does not show stale warning for fresh data", () => {
    render(
      <AvailabilityBadge
        availableLots={20}
        totalLots={100}
        status="Moderate"
        isStale={false}
      />,
    );

    expect(screen.queryByText("Availability data may be outdated")).toBeNull();
  });

  it("shows unavailable status", () => {
    render(
      <AvailabilityBadge
        availableLots={0}
        totalLots={100}
        status="Unavailable"
        isStale={false}
      />,
    );

    expect(screen.getByText("Unavailable")).toBeTruthy();
    expect(screen.getByText("0 / 100 lots available")).toBeTruthy();
  });

  it("exposes availability through an accessible progress bar", () => {
    render(
      <AvailabilityBadge
        availableLots={60}
        totalLots={100}
        status="High"
        isStale={false}
      />,
    );

    const progress = screen.getByRole("progressbar", {
      name: "Available parking spaces",
    });

    expect(progress.getAttribute("aria-valuenow")).toBe("60");
    expect(progress.getAttribute("aria-valuemax")).toBe("100");
  });

  it("handles zero capacity without an invalid percentage", () => {
    render(
      <AvailabilityBadge
        availableLots={0}
        totalLots={0}
        status="Unavailable"
        isStale={false}
      />,
    );

    const progress = screen.getByRole("progressbar", {
      name: "Available parking spaces",
    });

    expect(progress.getAttribute("aria-valuenow")).toBe("0");
  });
});
