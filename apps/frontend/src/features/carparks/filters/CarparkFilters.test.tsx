import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CarparkFilters } from "./CarparkFilters";

afterEach(() => {
  cleanup();
});

describe("CarparkFilters", () => {
  it("toggles EV charging filter", () => {
    const onChange = vi.fn();

    render(<CarparkFilters onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "EV Charging" }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        evChargingOnly: true,
      }),
    );
  });

  it("toggles sheltered filter", () => {
    const onChange = vi.fn();

    render(<CarparkFilters onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Sheltered" }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        shelteredOnly: true,
      }),
    );
  });

  it("updates minimum availability filter", () => {
    const onChange = vi.fn();

    render(<CarparkFilters onChange={onChange} />);

    fireEvent.change(screen.getByRole("combobox", { name: "Availability" }), {
      target: { value: "Moderate" },
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        minAvailability: "Moderate",
      }),
    );
  });

  it("updates maximum cost filter", () => {
    const onChange = vi.fn();

    render(<CarparkFilters onChange={onChange} />);

    fireEvent.change(screen.getByRole("spinbutton", { name: "Max Cost" }), {
      target: { value: "2.5" },
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        maxCost: 2.5,
      }),
    );
  });

  it("clears every filter and resets the controls", () => {
    const onChange = vi.fn();

    render(<CarparkFilters onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "EV Charging" }));

    fireEvent.click(screen.getByRole("button", { name: "Sheltered" }));

    fireEvent.change(screen.getByRole("combobox", { name: "Availability" }), {
      target: { value: "Moderate" },
    });

    fireEvent.change(screen.getByRole("spinbutton", { name: "Max Cost" }), {
      target: { value: "2.5" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Clear Filters" }));

    expect(onChange).toHaveBeenLastCalledWith({
      evChargingOnly: false,
      shelteredOnly: false,
    });

    expect(
      screen
        .getByRole("button", { name: "EV Charging" })
        .getAttribute("aria-pressed"),
    ).toBe("false");

    expect(
      screen
        .getByRole("button", { name: "Sheltered" })
        .getAttribute("aria-pressed"),
    ).toBe("false");

    expect(
      (
        screen.getByRole("combobox", {
          name: "Availability",
        }) as HTMLSelectElement
      ).value,
    ).toBe("");

    expect(
      (
        screen.getByRole("spinbutton", {
          name: "Max Cost",
        }) as HTMLInputElement
      ).value,
    ).toBe("");
  });
});
