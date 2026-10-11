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
    throw new Error("Unable to update availability alert");
  }
}
