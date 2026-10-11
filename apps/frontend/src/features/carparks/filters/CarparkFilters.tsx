import { useState, type CSSProperties } from "react";
import { Button, Chip, vars } from "../../../components";

type AvailabilityFilter = "High" | "Moderate" | "Low";

export interface CarparkFilterValues {
  evChargingOnly: boolean;
  shelteredOnly: boolean;
  maxCost?: number;
  minAvailability?: AvailabilityFilter;
}

interface CarparkFiltersProps {
  onChange: (filters: CarparkFilterValues) => void;
}

const fieldStyle: CSSProperties = {
  padding: vars.space[2],
  borderWidth: "thin",
  borderStyle: "solid",
  borderColor: vars.color.border,
  borderRadius: vars.radius.sm,
  backgroundColor: vars.color.background,
  color: vars.color.textPrimary,
  font: "inherit",
  maxWidth: "100%",
};

const labelStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: vars.space[2],
  color: vars.color.textPrimary,
};

export function CarparkFilters({ onChange }: CarparkFiltersProps) {
  const [filters, setFilters] = useState<CarparkFilterValues>({
    evChargingOnly: false,
    shelteredOnly: false,
  });

  function updateFilters(nextFilters: CarparkFilterValues) {
    setFilters(nextFilters);
    onChange(nextFilters);
  }

  return (
    <div
      style={{
        display: "flex",
        gap: vars.space[3],
        alignItems: "center",
        flexWrap: "wrap",
        fontFamily: vars.font.family,
        fontSize: vars.fontSize.sm,
      }}
    >
      <Chip
        selected={filters.evChargingOnly}
        onClick={() =>
          updateFilters({
            ...filters,
            evChargingOnly: !filters.evChargingOnly,
          })
        }
      >
        EV Charging
      </Chip>

      <Chip
        selected={filters.shelteredOnly}
        onClick={() =>
          updateFilters({
            ...filters,
            shelteredOnly: !filters.shelteredOnly,
          })
        }
      >
        Sheltered
      </Chip>

      <label style={labelStyle}>
        Availability
        <select
          style={fieldStyle}
          value={filters.minAvailability ?? ""}
          onChange={(event) => {
            const value = event.target.value;
            const nextFilters = { ...filters };

            if (value === "") {
              delete nextFilters.minAvailability;
            } else if (
              value === "Low" ||
              value === "Moderate" ||
              value === "High"
            ) {
              nextFilters.minAvailability = value;
            } else {
              return;
            }

            updateFilters(nextFilters);
          }}
        >
          <option value="">Any</option>
          <option value="Low">Low+</option>
          <option value="Moderate">Moderate+</option>
          <option value="High">High</option>
        </select>
      </label>

      <label style={labelStyle}>
        Max Cost
        <input
          type="number"
          min="0"
          step="0.1"
          value={filters.maxCost ?? ""}
          style={{
            ...fieldStyle,
            width: `calc(${vars.space[8]} * 3)`,
          }}
          onChange={(event) => {
            const value = event.target.value;
            const nextFilters = { ...filters };

            if (value === "") {
              delete nextFilters.maxCost;
            } else {
              const cost = Number(value);

              if (!Number.isFinite(cost) || cost < 0) {
                return;
              }

              nextFilters.maxCost = cost;
            }

            updateFilters(nextFilters);
          }}
        />
      </label>

      <Button
        variant="ghost"
        size="sm"
        onClick={() =>
          updateFilters({
            evChargingOnly: false,
            shelteredOnly: false,
          })
        }
      >
        Clear Filters
      </Button>
    </div>
  );
}
