export interface AlertSubscription {
  alertId: string;
  carParkNo: string;
  enabled: boolean;
}

export async function createAvailabilityAlert(
  carParkNo: string,
  accessToken: string,
): Promise<AlertSubscription> {
  const response = await fetch("/api/alerts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ carParkNo }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Session expired. Please log out and sign in again.");
    }
    if (response.status === 404) {
      throw new Error("Live availability alerts are not supported for this carpark.");
    }
    throw new Error("Unable to create availability alert");
  }

  return response.json();
}

export async function updateAvailabilityAlert(
  alertId: string,
  enabled: boolean,
  accessToken: string,
): Promise<void> {
  const response = await fetch(`/api/alerts/${encodeURIComponent(alertId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ enabled }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Session expired. Please log out and sign in again.");
    }
    if (response.status === 404) {
      throw new Error("Live availability alerts are not supported for this carpark.");
    }
    throw new Error("Unable to update availability alert");
  }
}

export async function testTriggerAvailabilityAlert(
  carParkNo: string,
  accessToken: string,
  status: 'High' | 'Moderate' | 'Low' = 'Low',
): Promise<{ success: boolean; newStatus: string; notificationsSent: number }> {
  const response = await fetch("/api/alerts/test-trigger", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ carParkNo, status }),
  });

  if (!response.ok) {
    throw new Error("Unable to trigger test alert");
  }

  return response.json();
}
