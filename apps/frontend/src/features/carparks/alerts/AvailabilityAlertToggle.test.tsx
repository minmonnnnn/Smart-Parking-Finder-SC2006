import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AvailabilityAlertToggle } from "./AvailabilityAlertToggle";

afterEach(() => {
  cleanup();
});

describe("AvailabilityAlertToggle", () => {
  it("calls onToggle when enabled", () => {
    const onToggle = vi.fn();

    render(<AvailabilityAlertToggle enabled={false} onToggle={onToggle} />);

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Notify me when availability changes",
      }),
    );

    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it("shows checked state when alert is enabled", () => {
    render(<AvailabilityAlertToggle enabled={true} onToggle={() => {}} />);

    const checkbox = screen.getByRole("checkbox", {
      name: "Notify me when availability changes",
    }) as HTMLInputElement;

    expect(checkbox.checked).toBe(true);
  });
});
