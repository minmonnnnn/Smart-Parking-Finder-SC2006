import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { vars } from "../../../components";
import { AvailabilityAlertMonitor } from "./AvailabilityAlertMonitor";
import { createAvailabilityAlert, updateAvailabilityAlert } from "./api";

interface SubscriptionState {
  alertId: string | null;
  enabled: boolean;
  pending: boolean;
  error: string | null;
}

interface AlertsContextValue {
  userId: string | null;
  subscriptions: ReadonlyMap<string, SubscriptionState>;
  setEnabled: (carParkNo: string, enabled: boolean) => Promise<void>;
}

interface ProviderProps {
  userId: string | null;
  accessToken: string | null;
  children: ReactNode;
}

const emptySubscription: SubscriptionState = {
  alertId: null,
  enabled: false,
  pending: false,
  error: null,
};

const AlertsContext = createContext<AlertsContextValue | null>(null);

export function AvailabilityAlertsProvider(props: ProviderProps) {
  return (
    <SessionAlertsProvider key={props.userId ?? "signed-out"} {...props} />
  );
}

function SessionAlertsProvider({
  userId,
  accessToken,
  children,
}: ProviderProps) {
  const [subscriptions, setSubscriptions] = useState(
    () => new Map<string, SubscriptionState>(),
  );
  const subscriptionsRef = useRef(subscriptions);
  const active = useRef(false);

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  function store(carParkNo: string, state: SubscriptionState) {
    const next = new Map(subscriptionsRef.current);
    next.set(carParkNo, state);
    subscriptionsRef.current = next;
    setSubscriptions(next);
  }

  async function setEnabled(carParkNo: string, enabled: boolean) {
    if (!userId || !accessToken || !active.current) return;

    const previous =
      subscriptionsRef.current.get(carParkNo) ?? emptySubscription;

    if (previous.pending || previous.enabled === enabled) return;

    store(carParkNo, {
      ...previous,
      pending: true,
      error: null,
    });

    try {
      const next: SubscriptionState = {
        ...previous,
        enabled,
        pending: false,
        error: null,
      };

      if (previous.alertId) {
        await updateAvailabilityAlert(previous.alertId, enabled, accessToken);
      } else {
        const subscription = await createAvailabilityAlert(
          carParkNo,
          accessToken,
        );
        next.alertId = subscription.alertId;
        next.enabled = subscription.enabled;
      }

      if (active.current) store(carParkNo, next);
    } catch (error) {
      if (!active.current) return;

      store(carParkNo, {
        ...previous,
        pending: false,
        error:
          error instanceof Error && error.message !== "Request failed"
            ? error.message
            : "Unable to update availability alerts",
      });
    }
  }

  return (
    <AlertsContext.Provider value={{ userId, subscriptions, setEnabled }}>
      {children}

      {userId &&
        accessToken &&
        createPortal(
          <div
            aria-label="Availability notifications"
            style={{
              position: "fixed",
              top: vars.space[3],
              left: vars.space[3],
              right: vars.space[3],
              maxWidth: vars.layout.viewportWidth,
              margin: "0 auto",
              zIndex: 10000,
              display: "grid",
              gap: vars.space[2],
              maxHeight: "35vh",
              overflowY: "auto",
              pointerEvents: "none",
            }}
          >
            {[...subscriptions.entries()].map(([carParkNo, state]) =>
              state.enabled ? (
                <AvailabilityAlertMonitor
                  key={carParkNo}
                  carParkNo={carParkNo}
                />
              ) : null,
            )}
          </div>,
          document.body,
        )}
    </AlertsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAvailabilityAlerts() {
  const context = useContext(AlertsContext);

  if (!context) {
    throw new Error(
      "AvailabilityAlertControl must be inside AvailabilityAlertsProvider",
    );
  }

  return context;
}
