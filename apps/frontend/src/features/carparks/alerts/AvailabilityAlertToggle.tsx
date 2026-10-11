interface AvailabilityAlertToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export function AvailabilityAlertToggle({
  enabled,
  onToggle,
}: AvailabilityAlertToggleProps) {
  return (
    <label>
      <input
        type="checkbox"
        checked={enabled}
        onChange={(event) => {
          onToggle(event.target.checked);
        }}
      />
      Notify me when availability changes
    </label>
  );
}
