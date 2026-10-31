import { vars } from "../../../components";
import { AvailabilityAlertToggle } from "./AvailabilityAlertToggle";
import { useAvailabilityAlerts } from "./AvailabilityAlertsProvider";

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
