import { ProgressBar, vars } from "../../../components";

interface AvailabilityBadgeProps {
  availableLots: number;
  totalLots: number;
  status: "High" | "Moderate" | "Low" | "Unavailable";
  isStale: boolean;
}

export function AvailabilityBadge({
  availableLots,
  totalLots,
  status,
  isStale,
}: AvailabilityBadgeProps) {
  const percentage =
    totalLots > 0
      ? Math.min(100, Math.max(0, (availableLots / totalLots) * 100))
      : 0;

  const tone =
    status === "High"
      ? "success"
      : status === "Moderate"
        ? "warning"
        : "danger";

  return (
    <div
      style={{
        display: "grid",
        gap: vars.space[2],
        color: vars.color.textPrimary,
      }}
    >
      <strong>{status}</strong>

      <div>
        {availableLots} / {totalLots} lots available
      </div>

      <ProgressBar
        label="Available parking spaces"
        value={percentage}
        max={100}
        tone={tone}
      />

      {isStale && (
        <small style={{ color: vars.color.textSecondary }}>
          Availability data may be outdated
        </small>
      )}
    </div>
  );
}
