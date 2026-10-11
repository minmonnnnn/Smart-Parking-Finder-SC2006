import { useEffect, useRef, useState } from "react";
import { AvailabilityAlertToggle } from "./AvailabilityAlertToggle";
import { createAvailabilityAlert, updateAvailabilityAlert } from "./api";

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
    return <p>Sign in to enable availability alerts.</p>;
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
    } catch {
      if (active.current) {
        setError("Unable to update availability alerts");
      }
    } finally {
      inFlight.current = false;

      if (active.current) {
        setPending(false);
      }
    }
  }

  return (
    <div>
      <fieldset disabled={pending}>
        <legend>Availability alerts</legend>

        <AvailabilityAlertToggle
          enabled={enabled}
          onToggle={(nextEnabled) => {
            void toggle(nextEnabled);
          }}
        />
      </fieldset>

      {pending && <p role="status">Updating alert...</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
