import { useEffect, useState } from "react";
import { fetchAvailability, type AvailabilityInfo } from "../availability/api";
import { Button, vars } from "../../../components";

interface AvailabilityAlertMonitorProps {
  carParkNo: string;
}

interface MonitorState {
  message: string | null;
  error: string | null;
}

export function AvailabilityAlertMonitor({
  carParkNo,
}: AvailabilityAlertMonitorProps) {
  return <Monitor key={carParkNo} carParkNo={carParkNo} />;
}

function Monitor({ carParkNo }: AvailabilityAlertMonitorProps) {
  const [state, setState] = useState<MonitorState>({
    message: null,
    error: null,
  });

  useEffect(() => {
    let active = true;
    let inFlight = false;
    let controller: AbortController | undefined;
    let previousStatus: AvailabilityInfo["status"] | null = null;

    async function refresh(): Promise<void> {
      if (!active || inFlight) return;

      inFlight = true;
      controller = new AbortController();

      try {
        const availability = await fetchAvailability(
          carParkNo,
          controller.signal,
        );

        if (!active) return;

        if (availability.isStale) {
          setState((current) => ({
            ...current,
            error:
              "Availability is outdated. Alerts will resume when fresh data returns.",
          }));
          return;
        }

        const changed =
          previousStatus !== null && previousStatus !== availability.status;

        const message = changed
          ? `${carParkNo} availability changed from ${previousStatus} to ${availability.status}. ${availability.availableLots} of ${availability.totalLots} lots available.`
          : null;

        previousStatus = availability.status;

        setState((current) => ({
          message: message ?? current.message,
          error: null,
        }));
      } catch {
        if (active) {
          setState((current) => ({
            ...current,
            error: "Unable to check availability alerts. Retrying shortly.",
          }));
        }
      } finally {
        inFlight = false;
      }
    }

    void refresh();

    const intervalId = window.setInterval(() => {
      void refresh();
    }, 60_000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      controller?.abort();
    };
  }, [carParkNo]);

  if (!state.message && !state.error) return null;

  return (
    <div
      style={{
        padding: vars.space[3],
        background: vars.color.background,
        color: vars.color.textPrimary,
        border: `1px solid ${vars.color.border}`,
        borderRadius: vars.radius.md,
        boxShadow: vars.shadow.raised,
        fontFamily: vars.font.family,
        fontSize: vars.fontSize.sm,
        pointerEvents: "auto",
      }}
    >
      {state.message && (
        <p role="status" style={{ margin: 0 }}>
          {state.message}
        </p>
      )}

      {state.error && (
        <p role="alert" style={{ margin: 0, color: vars.color.danger }}>
          {state.error}
        </p>
      )}

      <Button
        variant="ghost"
        size="sm"
        aria-label={`Dismiss availability notification for ${carParkNo}`}
        onClick={() => setState({ message: null, error: null })}
      >
        Dismiss
      </Button>
    </div>
  );
}
