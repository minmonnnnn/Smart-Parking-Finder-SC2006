import type { AvailabilityInfo } from "@smart-parking/shared-types";
export type { AvailabilityInfo } from "@smart-parking/shared-types";

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
