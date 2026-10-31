import { vars } from "../../../components";
import { AvailabilityAlertToggle } from "./AvailabilityAlertToggle";
import { useAvailabilityAlerts } from "./AvailabilityAlertsProvider";
import type { AvailabilityTestWindow } from "./AvailabilityAlertMonitor";

interface AvailabilityAlertControlProps {
  carParkNo: string;
  userId: string | null;
  accessToken: string | null;
}

export function AvailabilityAlertControl({
  carParkNo,
  userId,
  accessToken,
}: AvailabilityAlertControlProps) {
  const alerts = useAvailabilityAlerts();

  if (!userId || !accessToken || alerts.userId !== userId) {
    return (
      <p
        style={{
          marginTop: vars.space[3],
          fontSize: vars.fontSize.xs,
          color: vars.color.textSecondary,
        }}
      >
        Sign in to enable availability alerts.
      </p>
    );
  }

  const subscription = alerts.subscriptions.get(carParkNo);
  const enabled = subscription?.enabled ?? false;
  const pending = subscription?.pending ?? false;
  const error = subscription?.error ?? null;

  return (
    <div
      style={{
        marginTop: vars.space[3],
        padding: vars.space[3],
        background: vars.color.surface,
        borderRadius: vars.radius.md,
        border: `1px solid ${vars.color.border}`,
      }}
    >
      <fieldset
        disabled={pending}
        style={{ border: "none", padding: 0, margin: 0 }}
      >
        <legend
          style={{
            fontSize: vars.fontSize.xs,
            fontWeight: vars.fontWeight.semibold,
            color: vars.color.textMuted,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            marginBottom: vars.space[2],
          }}
        >
          Availability alerts
        </legend>

        <AvailabilityAlertToggle
          enabled={enabled}
          onToggle={(nextEnabled) => {
            void alerts.setEnabled(carParkNo, nextEnabled);
          }}
        />
      </fieldset>

      {enabled && (
        <div style={{ marginTop: vars.space[2] }}>
          <button
            type="button"
            onClick={() => {
              const testWindow = window as unknown as AvailabilityTestWindow;
              testWindow.__simulateAvailabilityAlert?.({ carParkNo });
            }}
            style={{
              padding: `${vars.space[1]} ${vars.space[2]}`,
              fontSize: vars.fontSize.xs,
              color: vars.color.secondary,
              background: "transparent",
              border: `1px dashed ${vars.color.secondary}`,
              borderRadius: vars.radius.sm,
              cursor: "pointer",
              fontWeight: vars.fontWeight.medium,
            }}
          >
            ⚡ Simulate Availability Alert
          </button>
        </div>
      )}

      {pending && (
        <p
          role="status"
          style={{
            margin: `${vars.space[2]} 0 0`,
            fontSize: vars.fontSize.xs,
            color: vars.color.textSecondary,
          }}
        >
          Updating alert...
        </p>
      )}

      {error && (
        <p
          role="alert"
          style={{
            margin: `${vars.space[2]} 0 0`,
            fontSize: vars.fontSize.xs,
            color: vars.color.danger,
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
