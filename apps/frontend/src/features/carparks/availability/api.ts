export interface AvailabilityInfo {
  availableLots: number;
  totalLots: number;
  status: "High" | "Moderate" | "Low" | "Unavailable";
  lastUpdated: string;
  isStale: boolean;
}

export async function fetchAvailability(
  carParkNo: string,
  signal?: AbortSignal,
): Promise<AvailabilityInfo> {
  const response = await fetch(
    `/api/carparks/${encodeURIComponent(carParkNo)}/availability`,
    signal ? { signal } : {},
  );

  if (!response.ok) {
    throw new Error("Failed to fetch carpark availability");
  }

  return response.json();
}
