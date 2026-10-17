import { useEffect, useRef, useState } from "react";
import { vars } from "../../../components";
import { AvailabilityAlertToggle } from "./AvailabilityAlertToggle";
import { createAvailabilityAlert, updateAvailabilityAlert } from "./api";
import { AvailabilityAlertMonitor } from "./AvailabilityAlertMonitor";

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
  if (!userId || !accessToken) {
    return (
      <div
        style={{
          marginTop: vars.space[3],
          padding: `${vars.space[2]} ${vars.space[3]}`,
          background: vars.color.surface,
          borderRadius: vars.radius.md,
          border: `1px solid ${vars.color.border}`,
          fontSize: vars.fontSize.xs,
          color: vars.color.textSecondary,
        }}
      >
        <p style={{ margin: 0 }}>Sign in to enable availability alerts.</p>
      </div>
    );
  }

  return (
    <SubscriptionControl
      key={JSON.stringify([userId, carParkNo])}
      carParkNo={carParkNo}
      accessToken={accessToken}
    />
  );
}

interface SubscriptionControlProps {
  carParkNo: string;
  accessToken: string;
}

function SubscriptionControl({
  carParkNo,
  accessToken,
}: SubscriptionControlProps) {
  const [alertId, setAlertId] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inFlight = useRef(false);
  const active = useRef(false);

  useEffect(() => {
    active.current = true;

    return () => {
      active.current = false;
    };
  }, []);

  async function toggle(nextEnabled: boolean) {
    if (inFlight.current) return;

    inFlight.current = true;
    setPending(true);
    setError(null);

    try {
      if (alertId) {
        await updateAvailabilityAlert(alertId, nextEnabled, accessToken);
      } else if (nextEnabled) {
        const subscription = await createAvailabilityAlert(
          carParkNo,
          accessToken,
        );

        if (active.current) {
          setAlertId(subscription.alertId);
        }
      }

      if (active.current) {
        setEnabled(nextEnabled);
      }
    } catch (err) {
      if (active.current) {
        const msg =
          err instanceof Error && err.message !== "Request failed"
            ? err.message
            : "Unable to update availability alerts";
        setError(msg);
      }
    } finally {
      inFlight.current = false;

      if (active.current) {
        setPending(false);
      }
    }
  }

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
        style={{
          border: "none",
          padding: 0,
          margin: 0,
        }}
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
            void toggle(nextEnabled);
          }}
        />
      </fieldset>

      {enabled && <AvailabilityAlertMonitor carParkNo={carParkNo} />}

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
