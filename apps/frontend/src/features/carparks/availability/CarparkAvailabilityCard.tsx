import { useEffect, useState } from "react";
import { AvailabilityBadge } from "./AvailabilityBadge";
import { fetchAvailability, type AvailabilityInfo } from "./api";

interface CarparkAvailabilityCardProps {
  carParkNo: string;
  name: string;
}

interface AvailabilityState {
  carParkNo: string;
  availability: AvailabilityInfo | null;
  error: string | null;
}

export function CarparkAvailabilityCard({
  carParkNo,
  name,
}: CarparkAvailabilityCardProps) {
  const [state, setState] = useState<AvailabilityState | null>(null);

  useEffect(() => {
    let active = true;
    let inFlight = false;
    let controller: AbortController | undefined;

    async function refresh() {
      if (inFlight) return;

      inFlight = true;
      controller = new AbortController();

      try {
        const availability = await fetchAvailability(
          carParkNo,
          controller.signal,
        );

        if (active) {
          setState({
            carParkNo,
            availability,
            error: null,
          });
        }
      } catch {
        if (active) {
          setState({
            carParkNo,
            availability: null,
            error: "Unable to load current availability",
          });
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
      controller?.abort();
      window.clearInterval(intervalId);
    };
  }, [carParkNo]);

  const current = state?.carParkNo === carParkNo ? state : null;

  return (
    <article>
      <h2>{carParkNo}</h2>
      <p>{name}</p>

      {!current && <p role="status">Loading availability...</p>}

      {current?.error && <p role="alert">{current.error}</p>}

      {current?.availability && (
        <AvailabilityBadge
          availableLots={current.availability.availableLots}
          totalLots={current.availability.totalLots}
          status={current.availability.status}
          isStale={current.availability.isStale}
        />
      )}
    </article>
  );
}
