import { vars } from "../../../components";

interface AvailabilityAlertToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export function AvailabilityAlertToggle({
  enabled,
  onToggle,
}: AvailabilityAlertToggleProps) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: vars.space[2],
        cursor: "pointer",
        fontSize: vars.fontSize.sm,
        color: vars.color.textPrimary,
        fontWeight: vars.fontWeight.medium,
        userSelect: "none",
      }}
    >
      <input
        type="checkbox"
        checked={enabled}
        onChange={(event) => {
          onToggle(event.target.checked);
        }}
        style={{
          width: 18,
          height: 18,
          cursor: "pointer",
          accentColor: vars.color.secondary,
        }}
      />
      Notify me when availability changes
    </label>
  );
}
