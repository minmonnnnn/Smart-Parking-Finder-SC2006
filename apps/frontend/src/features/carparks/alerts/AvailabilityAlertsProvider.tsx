import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Button, vars } from "../../../components";
import {
  AvailabilityAlertMonitor,
  SIMULATE_ALERT_EVENT,
  type AvailabilityTestWindow,
  type SimulateAvailabilityOptions,
} from "./AvailabilityAlertMonitor";
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
  const [simulatedNotification, setSimulatedNotification] = useState<{
    message: string;
    error: string | null;
    carParkNo?: string;
  } | null>(null);

  const subscriptionsRef = useRef(subscriptions);
  const active = useRef(false);

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  // Development & Testing helper: allows simulating an availability alert from console or UI
  useEffect(() => {
    const testWindow = window as unknown as AvailabilityTestWindow;

    testWindow.__simulateAvailabilityAlert = (
      options?: SimulateAvailabilityOptions,
    ) => {
      const activeCarparks = [...subscriptionsRef.current.entries()]
        .filter(([, s]) => s.enabled)
        .map(([cp]) => cp);

      const targetCarPark =
        options?.carParkNo ??
        (activeCarparks.length > 0 ? activeCarparks[0] : "TP21");

      const hasActiveMonitor =
        activeCarparks.length > 0 &&
        (!options?.carParkNo || activeCarparks.includes(options.carParkNo));

      if (hasActiveMonitor) {
        window.dispatchEvent(
          new CustomEvent(SIMULATE_ALERT_EVENT, {
            detail: {
              carParkNo: targetCarPark,
              ...options,
            },
          }),
        );
      } else {
        const from = options?.fromStatus ?? "High";
        const to =
          options?.toStatus ??
          (from === "High" ? "Moderate" : from === "Moderate" ? "Low" : "High");
        const total = options?.totalLots ?? 120;
        const available =
          options?.availableLots ??
          (to === "High" ? 48 : to === "Moderate" ? 24 : 5);
        const msg =
          options?.message ??
          `${targetCarPark} availability changed from ${from} to ${to}. ${available} of ${total} lots available.`;

        console.log(
          `[Test Alert] Simulated availability change for ${targetCarPark}: ${from} -> ${to}`,
        );
        setSimulatedNotification({
          message: msg,
          error: options?.error ?? null,
          carParkNo: targetCarPark,
        });
      }
    };

    return () => {
      delete testWindow.__simulateAvailabilityAlert;
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

  const showPortal =
    (userId && accessToken) || simulatedNotification !== null;

  return (
    <AlertsContext.Provider value={{ userId, subscriptions, setEnabled }}>
      {children}

      {showPortal &&
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
            {userId &&
              accessToken &&
              [...subscriptions.entries()].map(([carParkNo, state]) =>
                state.enabled ? (
                  <AvailabilityAlertMonitor
                    key={carParkNo}
                    carParkNo={carParkNo}
                  />
                ) : null,
              )}

            {simulatedNotification && (
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
                <p role="status" style={{ margin: 0 }}>
                  {simulatedNotification.message}
                </p>

                {simulatedNotification.error && (
                  <p
                    role="alert"
                    style={{ margin: 0, color: vars.color.danger }}
                  >
                    {simulatedNotification.error}
                  </p>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Dismiss availability notification${
                    simulatedNotification.carParkNo
                      ? ` for ${simulatedNotification.carParkNo}`
                      : ""
                  }`}
                  onClick={() => setSimulatedNotification(null)}
                >
                  Dismiss
                </Button>
              </div>
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
